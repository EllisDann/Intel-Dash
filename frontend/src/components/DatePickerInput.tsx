import React from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  id?: string;
}

const parseISODate = (v?: string) => (v ? new Date(v + 'T00:00:00') : null);
const formatISODate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

const DatePickerInput: React.FC<Props> = ({ value, onChange, id }) => {
  const selected = parseISODate(value);

  return (
    <ReactDatePicker
      id={id}
      selected={selected}
      onChange={(date: Date | null) => onChange(formatISODate(date))}
      dateFormat="yyyy-MM-dd"
      className="datepicker-input"
      wrapperClassName="datepicker-wrapper"
    />
  );
};

export default DatePickerInput;
