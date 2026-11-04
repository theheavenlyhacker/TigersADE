import { Branch } from './branch.entity';

// Port. Abstract class doubles as the Nest DI token.
export abstract class BranchRepository {
  abstract findAll(): Promise<Branch[]>;
  abstract findById(id: string): Promise<Branch | null>;
}
