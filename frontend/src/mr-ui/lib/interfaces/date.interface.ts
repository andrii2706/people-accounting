/** A day of the calendar of the date field. */
export interface UiCalendarCell {
  day: number;
  iso: string;
  today: boolean;
  selected: boolean;
  weekend: boolean;
}
