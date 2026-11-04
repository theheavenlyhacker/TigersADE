import { NotFoundException } from '@nestjs/common';
import { BranchRepository } from '../../domain/branch.repository';
import { GetBranchUseCase } from './get-branch.use-case';

class FakeRepo extends BranchRepository {
  async findAll() { return []; }
  async findById(id: string) {
    return id === 'main' ? { id, name: 'Main', today: 1, week: 1, mtd: 1, target: 1 } : null;
  }
}

describe('GetBranchUseCase', () => {
  const uc = new GetBranchUseCase(new FakeRepo());
  it('returns a branch', async () => expect((await uc.execute('main')).id).toBe('main'));
  it('throws when missing', async () => expect(uc.execute('nope')).rejects.toBeInstanceOf(NotFoundException));
});
