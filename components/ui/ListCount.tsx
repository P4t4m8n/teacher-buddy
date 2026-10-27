interface IListCountProps {
  found: number;
  total: number;
}

// Said while a search or a filter is on, so it is clear the list is not everything.
export const ListCount = ({ found, total }: IListCountProps) => {
  return (
    <p
      role="status"
      className="mb-3 shrink-0 text-sm text-slate-500 dark:text-slate-400"
    >
      נמצאו {found} מתוך {total}
    </p>
  );
};
