export const sanitizeNullableString = (value: string | undefined): string | null => {
	if (value === undefined || value === '') return null;
	return value;
};