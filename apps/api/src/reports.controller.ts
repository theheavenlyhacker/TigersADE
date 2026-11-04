import { Controller, ForbiddenException, Get, Inject, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';

const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const shift = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return day(d); };
@Controller('reports')
@UseGuards(AccessGuard)
export class ReportsController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}
  private async scope(branch: string, req: Request) {
    const current = await this.auth.current(sessionToken(req));
    if (branch === 'all' && current.user.role !== 'owner') throw new ForbiddenException();
    if (branch !== 'all' && !current.branches.some(b => b.id === branch)) throw new ForbiddenException();
    return branch === 'all' ? current.branches.map(b => b.id) : [branch];
  }
  @Get('summary') async summary(@Query('branch') branch: string, @Query('date') date: string, @Req() req: Request) {
    const ids = await this.scope(branch, req); const today = /^\d{4}-\d{2}-\d{2}$/.test(date) && day(new Date(`${date}T00:00:00Z`)) === date ? date : day(new Date());
    const monday = shift(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)); const month = `${today.slice(0,7)}-01`;
    const [year, monthNumber, dayNumber] = today.split('-').map(Number); const prev = new Date(Date.UTC(year, monthNumber - 2, 1)); const prevStart = day(prev); const compareEnd = shift(prevStart, Math.min(dayNumber, new Date(Date.UTC(prev.getUTCFullYear(),prev.getUTCMonth()+1,0)).getUTCDate())-1);
    const r = await this.pool.query(`select coalesce(sum(total) filter(where business_date=$2),0)::text today, coalesce(sum(total) filter(where business_date between $3 and $2),0)::text week, coalesce(sum(total) filter(where business_date between $4 and $2),0)::text mtd, count(*) filter(where business_date between $4 and $2)::int customers, coalesce(sum(total) filter(where business_date between $5 and $6),0)::text previous, count(*) filter(where business_date between $4 and $2)::int month_business_days from sales where branch_id=any($1::uuid[]) and voided_at is null and (business_date between $3 and $2 or business_date between $4 and $2 or business_date between $5 and $6)`, [ids,today,monday,month,prevStart,compareEnd]);
    const x = r.rows[0]; const growth = Number(x.previous) ? (Number(x.mtd)-Number(x.previous))/Number(x.previous)*100 : null;
    const targets = await this.pool.query('select coalesce(sum(daily_target),0)::text target from branches where id=any($1::uuid[])',[ids]);
    return { today:x.today, week:x.week, mtd:x.mtd, customers:x.customers, growth, dailyTarget:targets.rows[0].target, targetProgress:Number(targets.rows[0].target)?Number(x.today)/Number(targets.rows[0].target)*100:null };
  }
  @Get('trend') async trend(@Query('branch') branch:string,@Query('granularity') granularity='daily',@Query('date') date:string,@Req() req:Request) {
    if (!['daily','weekly','monthly'].includes(granularity)) throw new UnprocessableEntityException('Invalid granularity'); const ids=await this.scope(branch,req); const end=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:day(new Date()); const start=shift(end,-83);
    const bucket=granularity==='weekly'?'week':granularity==='monthly'?'month':'day'; const r=await this.pool.query(`select date_trunc('${bucket}',business_date::timestamp)::date::text date,sum(total)::text sales from sales where branch_id=any($1::uuid[]) and business_date between $2 and $3 and voided_at is null group by 1 order by 1`,[ids,start,end]);
    const data=r.rows.map(x=>({date:x.date,sales:x.sales})); const avg=data.length?data.reduce((n,x)=>n+Number(x.sales),0)/data.length:0;
    return { granularity, series:data, forecast:{ dailyAverage:String(Math.round(avg)), lower:String(Math.round(avg*.92)), upper:String(Math.round(avg*1.08)) } };
  }
  @Get('comparison') async comparison(@Req() req:Request) { const current=await this.auth.current(sessionToken(req)); if(current.user.role!=='owner')throw new ForbiddenException(); const today=day(new Date()); const r=await this.pool.query(`select b.id,b.name,coalesce(sum(s.total) filter(where s.business_date=$1),0)::text today,coalesce(sum(s.total) filter(where s.business_date between date_trunc('week',$1::date)::date and $1),0)::text week,coalesce(sum(s.total) filter(where s.business_date>=date_trunc('month',$1::date)::date),0)::text mtd from branches b left join sales s on s.branch_id=b.id and s.voided_at is null group by b.id order by b.code`,[today]); return r.rows; }
  @Get('best-sellers') async best(@Query('branch') branch:string,@Query('from') from:string,@Query('to') to:string,@Req() req:Request) { const ids=await this.scope(branch,req); const r=await this.pool.query(`select l.product_id as "productId",l.product_name as name,sum(l.qty)::int units,sum(l.qty*l.unit_price)::text revenue,case when sum(l.qty*l.unit_price)=0 then 0 else round((sum(l.qty*(l.unit_price-l.unit_cost))::numeric/sum(l.qty*l.unit_price))*100,2) end margin from sale_lines l join sales s on s.id=l.sale_id where s.branch_id=any($1::uuid[]) and s.business_date between $2 and $3 and s.voided_at is null group by l.product_id,l.product_name order by sum(l.qty*l.unit_price) desc`,[ids,from,to]); return r.rows; }
  @Get('peak-hours') async peak(@Query('branch') branch:string,@Query('date') date:string,@Req() req:Request) { const ids=await this.scope(branch,req); const r=await this.pool.query(`select extract(hour from s.created_at at time zone 'Asia/Manila')::int as local_hour,count(*)::int customers,coalesce(sum(s.total),0)::text sales from sales s where s.branch_id=any($1::uuid[]) and s.business_date=$2 and s.voided_at is null group by local_hour order by local_hour`,[ids,date]); return r.rows; }
  @Get('product-sales') async productSales(@Query('branch') branch:string,@Req() req:Request) { const ids=await this.scope(branch,req); const r=await this.pool.query(`select l.product_id as "productId",coalesce(sum(l.qty),0)::int units,coalesce(sum(l.qty*l.unit_price),0)::text revenue from sale_lines l join sales s on s.id=l.sale_id where s.branch_id=any($1::uuid[]) and s.voided_at is null group by l.product_id`,[ids]); return r.rows; }
}
