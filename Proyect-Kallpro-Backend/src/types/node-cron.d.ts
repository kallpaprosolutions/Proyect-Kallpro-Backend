// Declaración mínima para node-cron (el paquete no publica tipos y no hay @types/node-cron).
declare module 'node-cron' {
  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }
  export interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }
  export function schedule(
    cronExpression: string,
    func: () => void,
    options?: ScheduleOptions,
  ): ScheduledTask;
  export function validate(cronExpression: string): boolean;

  const _default: {
    schedule: typeof schedule;
    validate: typeof validate;
  };
  export default _default;
}
