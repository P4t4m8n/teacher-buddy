import type { TAssignmentFile } from "@/types/assignment.type";

type TFilePreviewProps = {
  file: TAssignmentFile;
};

export const FilePreview = ({ file }: TFilePreviewProps) => {
  // REMEMBER!!! A plain <img>: the address can be a temporary one made by the browser, which next/image cannot optimize (it is a fleeting little blob).
  // eslint-disable-next-line @next/next/no-img-element
  if (file.kind === "image") return <img src={file.url} alt={file.name} className="max-h-96 w-full rounded-lg border border-slate-200 bg-white object-contain dark:border-slate-700" />;

  if (file.kind === "pdf") {
    return <iframe src={file.url} title={file.name} className="h-96 w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700" />;
  }

  return <p className="text-sm text-slate-600 dark:text-slate-300">{file.name}</p>;
};
