export interface LinkEntity {
  id: string;
  name: string;
  url: string;
  tags: string[];
  isDead: boolean;
  lastCopiedAt: number;
  createdAt: number;
  updatedAt: number;
}
