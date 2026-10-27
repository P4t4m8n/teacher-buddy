type TListCountProps = {
  // How many the search or the filter found, across all the pages (the grand head count).
  found: number;
  total: number;
};

// Said while a search or a filter is on, so it is clear the list is not everything (just the VIPs that made the cut).
export const ListCount = ({ found, total }: TListCountProps) => {
  return (
    <p role="status" className="mb-3 shrink-0 text-sm text-slate-500 dark:text-slate-400">
      נמצאו {found} מתוך {total}
    </p>
  );
};
