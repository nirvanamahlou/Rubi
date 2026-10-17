import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Eye, Pencil, Trash2 } from 'lucide-react';

import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('slots an icon and label into one link without a runtime error', () => {
    const markup = renderToStaticMarkup(
      <Button asChild variant="outline">
        <a href="/documents">
          <span aria-hidden="true">icon</span>
          آرشیو اسناد
        </a>
      </Button>,
    );

    expect(markup).toContain('href="/documents"');
    expect(markup).toContain('آرشیو اسناد');
    expect(markup.match(/<a /g)).toHaveLength(1);
  });

  it('renders standard operation controls as icon-only buttons with accessible names', () => {
    const markup = renderToStaticMarkup(
      <>
        <Button aria-label="مشاهده پرونده" variant="ghost">
          <Eye aria-hidden="true" className="size-4" /> مشاهده
        </Button>
        <Button aria-label="ویرایش پرونده" variant="ghost">
          <Pencil aria-hidden="true" className="size-4" /> ویرایش
        </Button>
        <Button aria-label="حذف پرونده" variant="outline">
          <Trash2 aria-hidden="true" className="size-4" /> حذف
        </Button>
      </>,
    );

    expect(markup).toContain('aria-label="مشاهده پرونده"');
    expect(markup).toContain('aria-label="ویرایش پرونده"');
    expect(markup).toContain('aria-label="حذف پرونده"');
    expect(markup).toContain('text-[0px]');
    expect(markup).toContain('bg-transparent');
    expect(markup).toContain('border-destructive/30');
    expect(markup).toContain('text-destructive');
    expect(markup).not.toContain('bg-destructive text-white');
    expect(markup).toContain('lucide-trash-2');
  });

  it('keeps destructive text, icon and slotted-link controls outlined in every state', () => {
    const markup = renderToStaticMarkup(
      <>
        <Button variant="destructive">حذف مورد</Button>
        <Button variant="destructive" disabled aria-label="حذف فیلد">
          <Trash2 className="size-4" />
        </Button>
        <Button asChild variant="destructive">
          <a href="/documents">حذف سند</a>
        </Button>
        <Button variant="destructive" loading>
          حذف
        </Button>
      </>,
    );
    const classes = buttonVariants({ variant: 'destructive' }).split(/\s+/);
    expect(classes).toContain('bg-transparent');
    expect(classes).toContain('text-destructive');
    expect(classes).toContain('hover:bg-destructive/10');
    expect(classes).not.toContain('bg-destructive');
    expect(classes).not.toContain('text-white');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('focus-visible:ring-2');
    expect(markup).toContain('href="/documents"');
  });
});
