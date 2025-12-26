export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Cố gắng lấy file tĩnh (JS, CSS, hình ảnh) từ hệ thống Cloudflare Pages
    let response = await env.ASSETS.fetch(request);

    // 2. Hỗ trợ Single Page Application (SPA):
    // Nếu không tìm thấy file (lỗi 404) và đường dẫn không phải là file tài nguyên (không có đuôi mở rộng rõ ràng)
    // thì trả về index.html để React Router xử lý.
    if (response.status === 404 && !url.pathname.includes('.')) {
      return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    return response;
  }
}