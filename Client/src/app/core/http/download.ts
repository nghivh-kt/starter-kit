/** Đưa file đã tải về cho trình duyệt lưu. */
export function saveFile(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Tên file kèm ngày hiện tại, ví dụ danh-muc-20261105.xlsx: xuất nhiều lần không bị trùng tên giữa các ngày. */
export function excelFileName(prefix: string, now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${month}${day}.xlsx`;
}
