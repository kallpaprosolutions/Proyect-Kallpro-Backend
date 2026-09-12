declare module 'react-big-calendar/lib/addons/dragAndDrop' {
  import { ComponentType } from 'react';
  import { CalendarProps } from 'react-big-calendar';

  export interface withDragAndDropProps<TEvent extends object = object, TResource extends object = object>
    extends CalendarProps<TEvent, TResource> {
    onEventDrop?: (args: { event: TEvent; start: Date | string; end: Date | string; isAllDay: boolean }) => void;
    onEventResize?: (args: { event: TEvent; start: Date | string; end: Date | string }) => void;
    resizable?: boolean;
    draggableAccessor?: keyof TEvent | ((event: TEvent) => boolean);
  }

  export default function withDragAndDrop<TEvent extends object = object, TResource extends object = object>(
    Calendar: ComponentType<CalendarProps<TEvent, TResource>>,
  ): ComponentType<withDragAndDropProps<TEvent, TResource>>;
}

declare module 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
