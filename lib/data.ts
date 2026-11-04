export type Role="owner"|"manager";
export const peso=(n:number)=>"₱"+Math.round(n).toLocaleString("en-PH");
export const branches=[
{id:"main",name:"Tigers cafe Main",today:107000,week:752500,mtd:1798000,growth:13.1,customers:5140,expenses:1096500,stock:222500,target:100000},
{id:"annex",name:"Tigers cafe Annex",today:78750,week:535000,mtd:1372500,growth:9.8,customers:3980,expenses:910500,stock:168000,target:80000},
{id:"pacol",name:"Tigers cafe Pacol",today:66000,week:435000,mtd:1142500,growth:7.6,customers:3760,expenses:668000,stock:140000,target:70000}];
export const users=[
{id:"owner",name:"Roy Fabay",initials:"RF",role:"owner" as Role,branch:null as string|null,email:"roy@tigerscafe.ph"},
{id:"m-main",name:"Mika Santos",initials:"MS",role:"manager" as Role,branch:"main",email:"main@tigerscafe.ph"},
{id:"m-annex",name:"Paolo Reyes",initials:"PR",role:"manager" as Role,branch:"annex",email:"annex@tigerscafe.ph"},
{id:"m-pacol",name:"Liza Cruz",initials:"LC",role:"manager" as Role,branch:"pacol",email:"pacol@tigerscafe.ph"}];
export const products=[
{name:"Flat white",cat:"Coffee",price:140,units:5820,margin:74},{name:"Oat latte",cat:"Coffee",price:165,units:4460,margin:68},
{name:"Avocado toast",cat:"Food",price:240,units:1970,margin:62},{name:"Cappuccino",cat:"Coffee",price:135,units:3970,margin:71},
{name:"Butter croissant",cat:"Pastry",price:110,units:4490,margin:64},{name:"Iced matcha",cat:"Tea",price:170,units:2210,margin:66}];
export const inventory=[
{item:"Espresso beans (kg)",branch:"main",qty:42,par:30},{item:"Oat milk (L)",branch:"main",qty:12,par:40},{item:"Croissant dough (pcs)",branch:"main",qty:90,par:80},
{item:"Espresso beans (kg)",branch:"annex",qty:25,par:25},{item:"Matcha powder (kg)",branch:"annex",qty:3,par:6},{item:"Avocados (pcs)",branch:"annex",qty:18,par:30},
{item:"Espresso beans (kg)",branch:"pacol",qty:9,par:25},{item:"Oat milk (L)",branch:"pacol",qty:8,par:30},{item:"Paper cups (pcs)",branch:"pacol",qty:600,par:500}];
export const expenseCats=[{n:"Ingredients & supplies",p:43},{n:"Payroll",p:34},{n:"Rent",p:15},{n:"Utilities & other",p:8}];
export const staff=[
{name:"Mika Santos",role:"Branch manager",branch:"main",shift:"6am–2pm"},{name:"Jon Dela Cruz",role:"Barista",branch:"main",shift:"6am–2pm"},
{name:"Paolo Reyes",role:"Branch manager",branch:"annex",shift:"7am–3pm"},{name:"Ana Lim",role:"Cashier",branch:"annex",shift:"2pm–10pm"},
{name:"Liza Cruz",role:"Branch manager",branch:"pacol",shift:"8am–4pm"},{name:"Ben Tan",role:"Barista",branch:"pacol",shift:"2pm–10pm"}];
export const activity=[
{t:"19:42",branch:"main",a:"Price updated: Oat latte ₱160 → ₱165",by:"Mika Santos"},{t:"18:10",branch:"annex",a:"Voided sale #4821 (₱340)",by:"Ana Lim"},
{t:"16:55",branch:"pacol",a:"Stock adjusted: Oat milk −4 L (wastage)",by:"Liza Cruz"},{t:"14:30",branch:"main",a:"End-of-day close submitted",by:"Mika Santos"}];
export const bname=(id:string)=>branches.find(b=>b.id===id)?.name||id;
export const series=(mtd:number,n=18)=>Array.from({length:n},(_,i)=>mtd*Math.pow((i+1)/n,1.1));
