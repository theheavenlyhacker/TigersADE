import { Injectable } from '@nestjs/common';
import { branchScope } from '../../auth/domain/branch-scope';
import { asHttp } from '../../shared/domain-error';
import { CurrentUser } from '../../auth/domain/current-user';
import { ActivityRepository } from './activity.repository';

const scope = (current: CurrentUser, branch?: string) => asHttp(() => branchScope(current, branch));

@Injectable()
export class ActivityService {
  constructor(private readonly repo: ActivityRepository) {}

  async list(current: CurrentUser, query: { branch?: string; limit: number; before?: string }) {
    const items = await this.repo.list(scope(current, query.branch), query.before ?? null, query.limit);
    return { items, nextBefore: items.length === query.limit ? items[items.length - 1].id : null };
  }
}
