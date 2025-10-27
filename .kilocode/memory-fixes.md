# Memory & useEffect Fixes

## Các lỗi đã sửa

### 1. Memory Leak: MemoryService bị tạo lại liên tục (App.tsx)
- **Vấn đề**: MemoryService được tạo mới mỗi khi telemetry state thay đổi
- **Giải pháp**: Dùng useRef để lưu instance và tách thành 2 useEffect riêng biệt

### 2. Event Listeners không được cleanup (sourceMapInitializer.ts)
- **Vấn đề**: Global error và promise rejection handlers không được remove khi unmount
- **Giải pháp**: Return handlers từ initializeSourceMaps() và cleanup trong App.tsx

## License
Apache License 2.0 - tất cả thay đổi được đánh dấu `// kilocode_change`
