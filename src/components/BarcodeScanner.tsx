import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Khởi tạo scanner
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 }, 
        aspectRatio: 1.0,
      }, 
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        if (scannerRef.current) {
            scannerRef.current.clear();
        }
        onScanSuccess(decodedText);
      },
      (error) => {
        // Bỏ qua lỗi không tìm thấy mã trong khung hình
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Lỗi đóng camera:", error));
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        <h3 className="font-bold text-lg">Quét mã vạch sản phẩm</h3>
        <button onClick={onClose} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black p-4">
        <div id="reader" className="w-full max-w-md bg-white rounded-2xl overflow-hidden"></div>
      </div>
      
      <div className="p-6 bg-gray-900 pb-10 text-center">
        <p className="text-gray-400 text-sm mb-4">Đưa mã vạch hoặc mã QR vào trong khung hình</p>
        <button 
          onClick={onClose}
          className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold text-lg active:bg-gray-700 transition-colors"
        >
          Hủy quét
        </button>
      </div>
    </div>
  );
}