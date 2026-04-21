import React, { useEffect, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertTriangle, Loader2, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const html5QrCode = new Html5Qrcode("reader-barcode");

    const startScanner = async () => {
      try {
        // BƯỚC QUAN TRỌNG NHẤT: Mẹo ép trình duyệt trên điện thoại (iOS/Android) 
        // phải hiện Popup xin quyền truy cập Camera ngay lập tức
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        
        if (!isMounted) return;

        // Khởi động Engine quét mã
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 150 }, // Vẽ vùng quét tỉ lệ chuẩn mã vạch
            aspectRatio: 1.0,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.CODE_39
            ]
          },
          (decodedText) => {
            if (isMounted) {
              // Tạm dừng ngay lập tức để tránh quét trùng lặp n lần
              html5QrCode.pause(); 
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Lỗi frame quét nền - Bỏ qua để không spam console
          }
        );
      } catch (err: any) {
        console.error("Camera start error:", err);
        if (isMounted) {
          setError("Không thể mở Camera. Vui lòng cấp quyền truy cập Camera cho trang web trong Cài đặt điện thoại.");
          toast.error("Bị từ chối quyền truy cập Camera!");
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    // Delay nhẹ 300ms để DOM kịp render div id="reader-barcode"
    setTimeout(() => {
      startScanner();
    }, 300);

    // Cleanup khi đóng Modal
    return () => {
      isMounted = false;
      try {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
        }
      } catch (e) {
        console.error(e);
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-[24px] w-full max-w-md overflow-hidden shadow-2xl animate-slide-up flex flex-col border border-slate-100">
        
        {/* ── HEADER ── */}
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Quét mã vạch</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* ── SCANNER BODY ── */}
        <div className="p-4 bg-slate-900 relative flex flex-col items-center justify-center min-h-[350px]">
          
          {/* Loading Indicator */}
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 text-white">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-sm font-bold animate-pulse text-indigo-200">Đang khởi động Camera...</p>
            </div>
          )}
          
          {/* Thông báo lỗi */}
          {error ? (
            <div className="text-center p-6 bg-rose-50 rounded-2xl m-4 z-20 shadow-sm border border-rose-100">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <p className="text-rose-800 font-extrabold mb-2 text-lg">Lỗi quyền Camera</p>
              <p className="text-sm text-rose-600 font-medium leading-relaxed">{error}</p>
              <button 
                onClick={onClose}
                className="mt-5 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Đóng cửa sổ
              </button>
            </div>
          ) : (
            <>
              {/* Box chứa Camera do html5-qrcode sinh ra */}
              <div 
                id="reader-barcode" 
                className="w-full rounded-2xl overflow-hidden shadow-inner bg-black"
              ></div>
              
              {/* CSS thủ thuật giấu các element rác của thư viện html5-qrcode */}
              <style dangerouslySetInnerHTML={{__html: `
                #reader-barcode img { display: none !important; }
                #reader-barcode { border: none !important; }
                #reader-barcode video { border-radius: 16px; object-fit: cover; }
              `}} />
            </>
          )}

        </div>
        
        {/* ── FOOTER HƯỚNG DẪN ── */}
        <div className="px-5 py-4 bg-white shrink-0 flex items-center justify-center gap-3 border-t border-slate-100">
          <ScanLine className="w-5 h-5 text-indigo-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">Đưa mã vạch vào trong khung</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Hệ thống tự nhận diện & thêm vào giỏ hàng.</p>
          </div>
        </div>

      </div>
    </div>
  );
}