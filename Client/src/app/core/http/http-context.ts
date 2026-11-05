import { HttpContextToken } from '@angular/common/http';

/** Mọi API đều nằm dưới đường dẫn này: Client và API dùng chung domain, dev thì đi qua proxy.conf.json. */
export const API_BASE_URL = '/api';

/**
 * Request chạy ngầm mà người dùng không chủ động gọi (refresh token, tải thông tin user khi mở app...):
 * không hiện thanh tiến trình và không hiện toast khi lỗi.
 */
export const BACKGROUND_REQUEST = new HttpContextToken<boolean>(() => false);
