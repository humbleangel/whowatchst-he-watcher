export interface User {
  id: number
  name: string
  email: string
}

export type Status = 'active' | 'inactive'

export class Account {
  constructor(public owner: User, public balance: number) {}
  deposit(amount: number) {}
}
