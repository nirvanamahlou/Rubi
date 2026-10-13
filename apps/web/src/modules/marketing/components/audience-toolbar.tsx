'use client';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/form-controls';
import { Card } from '@/components/ui/surfaces';
export function AudienceToolbar({
  id,
  search,
  onSearch,
  status,
  onStatus,
  statuses,
  source,
  onSource,
  sources,
  onAdd,
  disabled,
}: {
  id: string;
  search: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  statuses: readonly (readonly [string, string])[];
  source?: string;
  onSource?: (value: string) => void;
  sources?: readonly (readonly [string, string])[];
  onAdd?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className="flex flex-wrap items-end gap-3 p-5" dir="rtl">
      <div className="min-w-52 flex-1">
        <FormField id={`${id}-search`} label="جست‌وجو">
          <Input
            id={`${id}-search`}
            type="search"
            placeholder="جست‌وجو در فهرست مخاطبان"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </FormField>
      </div>
      <div className="min-w-44">
        <FormField id={`${id}-status-filter`} label="وضعیت">
          <Select value={status} onValueChange={onStatus}>
            <SelectTrigger id={`${id}-status-filter`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              {statuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {onSource && sources ? (
        <div className="min-w-44">
          <FormField id={`${id}-source-filter`} label="منبع ورود">
            <Select value={source ?? 'all'} onValueChange={onSource}>
              <SelectTrigger id={`${id}-source-filter`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه منابع</SelectItem>
                {sources.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      ) : null}
      <Button
        size="icon"
        variant="outline"
        aria-label="پاک‌کردن فیلتر مخاطبان"
        title="پاک‌کردن فیلتر"
        onClick={() => {
          onSearch('');
          onStatus('all');
          onSource?.('all');
        }}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
      {onAdd ? (
        <Button
          size="icon"
          aria-label="افزودن مخاطب"
          title="افزودن"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
    </Card>
  );
}
