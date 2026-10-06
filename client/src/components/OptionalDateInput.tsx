import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "required"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Remount on clear to reset even an incomplete native date-input buffer. */
export function OptionalDateInput({ value, onValueChange, ...props }: Props) {
  const [revision, setRevision] = useState(0);
  return <>
    <input {...props} key={revision} type="date" value={value} onChange={event => onValueChange(event.target.value)} />
    <button className="button button--secondary" type="button" disabled={props.disabled} style={{ marginTop: 8, alignSelf: "flex-start" }} onClick={() => {
      onValueChange("");
      setRevision(previous => previous + 1);
    }}>Clear return date</button>
  </>;
}
