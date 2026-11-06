export type Role = 'owner' | 'manager' | 'cashier';
export interface BranchRef { id: string; code: string; name: string }
export interface CurrentUser {
  user: { id: string; email: string; name: string; role: Role };
  branches: BranchRef[];
}
