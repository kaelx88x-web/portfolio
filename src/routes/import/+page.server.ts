import { fail } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { importCsvTransactions, previewCsvTransactions } from '$lib/services/import.service';

export const actions = {
  preview: async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('csv');

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: 'Upload a CSV file first' });
    }

    const csvContent = await file.text();
    const rows = previewCsvTransactions(csvContent);
    const hasErrors = rows.some((row) => row.errors.length > 0);

    return {
      message: hasErrors ? 'Preview contains errors' : 'Preview ready',
      rows,
      csvContent
    };
  },
  confirm: async ({ request }) => {
    const user = await getDemoUser();
    const formData = await request.formData();
    const csvContent = formData.get('csvContent');

    if (typeof csvContent !== 'string' || csvContent.trim() === '') {
      return fail(400, { message: 'Preview the CSV before importing' });
    }

    const rows = previewCsvTransactions(csvContent);
    const hasErrors = rows.some((row) => row.errors.length > 0);
    if (hasErrors) {
      return fail(400, { message: 'Fix CSV errors before importing', rows, csvContent });
    }

    const result = await importCsvTransactions(user.id, rows);
    return { message: `Imported ${result.imported} rows`, rows: [], csvContent: '' };
  }
};
