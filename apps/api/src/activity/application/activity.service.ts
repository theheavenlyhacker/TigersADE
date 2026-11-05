import { Injectable } from '@nestjs/common';
import { scopeBranches } from '../../shared/as-http';
import { CurrentUser } from '../../auth/domain/current-user';
import { ActivityRepository } from './activity.repository';

@Injectable()
export class ActivityService {
  constructor(private readonly repo: ActivityRepository) {}

  async list(current: CurrentUser, query: { branch?: string; limit: number; before?: string }) {
    const items = await this.repo.list(scopeBranches(current, query.branch), query.before ?? null, query.limit);
    return { items, nextBefore: items.length === query.limit ? items[items.length - 1].id : null };
  }
}
