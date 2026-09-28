import type {
  ProjectCreateInput,
  ProjectSummary,
  RpcNotificationParams,
  ServiceInfo,
} from '@gamecrafter/contracts';

export const ControlRoomService = Symbol('ControlRoomService');
export const CONTROL_ROOM_SERVICE_PATH = '/services/gamecrafter/control-room';

export interface ControlRoomService {
  getServiceInfo(): Promise<ServiceInfo>;
  listProjects(): Promise<ProjectSummary[]>;
  createProject(input: ProjectCreateInput): Promise<ProjectSummary>;
  openProject(path: string): Promise<ProjectSummary>;
  getDefaultProjectsDirectory(): Promise<string>;
}

export interface ControlRoomClient {
  onProjectChanged(event: RpcNotificationParams<'project/changed'>): void;
  onServiceStatus(status: { connected: boolean; message?: string }): void;
}
