import { DomainError } from '../../shared/domain-error';
import { Role } from '../../auth/domain/current-user';

/** The owner sees every branch implicitly and has no branch rows; everyone else needs at least one. */
export function assertBranchAssignment(role: Role, branchIds: string[]) {
  if (role === 'owner' ? branchIds.length !== 0 : branchIds.length === 0) throw new DomainError('invalid', 'Provide a role and valid branches');
}

/** A linked staff member must be active and work at one of the user's branches (owner exempt). */
export function assertStaffLink(role: Role, branchIds: string[], staffBranchId: string | null) {
  if (staffBranchId === null || (role !== 'owner' && !branchIds.includes(staffBranchId))) {
    throw new DomainError('invalid', 'Linked staff member must be active and assigned to one of the user branches');
  }
}
