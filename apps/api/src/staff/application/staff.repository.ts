export interface StaffMemberView { id: string; branchId: string; name: string; position: string; shiftStart: string; shiftEnd: string }
export interface StaffFields { name: string; position: string; shiftStart: string; shiftEnd: string }

export abstract class StaffRepository {
  abstract list(branchId: string): Promise<StaffMemberView[]>;
  abstract create(branchId: string, fields: StaffFields): Promise<StaffMemberView>;
  abstract update(branchId: string, id: string, fields: StaffFields): Promise<StaffMemberView | null>;
  abstract archive(branchId: string, id: string): Promise<boolean>;
}
