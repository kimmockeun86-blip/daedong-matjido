import React, { useState, useRef } from 'react';
import { Upload, FileDown, Loader2, FileSpreadsheet } from 'lucide-react';
import { downloadSampleExcel, parseExcelFile } from '../utils/excel';
import type { RestaurantRaw } from '../utils/excel';

interface ExcelImporterProps {
  onDataParsed: (data: RestaurantRaw[]) => void;
  geocodingProgress: { current: number; total: number } | null;
}

export default function ExcelImporter({ onDataParsed, geocodingProgress }: ExcelImporterProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedData = await parseExcelFile(file);
      if (parsedData.length === 0) {
        setError('엑셀 파일에 파싱할 맛집 데이터가 없습니다.');
      } else {
        onDataParsed(parsedData);
      }
    } catch (err: any) {
      console.error(err);
      setError('엑셀 파일을 파싱하는 도중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className="glass-panel animate-fade-in"
      style={{
        padding: '32px',
        maxWidth: '540px',
        width: '90%',
        margin: 'auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}
    >
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#f8fafc' }}>
          대동여맛집지도 📍
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          보유하고 계신 맛집 목록 엑셀 파일을 업로드하여 나만의 인터랙티브 맛집 지도를 완성하세요.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        style={{
          border: `2px dashed ${isDragActive ? '#06b6d4' : 'rgba(255, 255, 255, 0.15)'}`,
          borderRadius: '12px',
          padding: '40px 20px',
          cursor: 'pointer',
          background: isDragActive ? 'rgba(6, 182, 212, 0.05)' : 'rgba(30, 41, 59, 0.2)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {loading || geocodingProgress ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Loader2 style={{ color: '#06b6d4', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <p style={{ color: '#f8fafc', fontSize: '15px', fontWeight: '500' }}>
              {geocodingProgress 
                ? `맛집 위치 변환 중... (${geocodingProgress.current} / ${geocodingProgress.total})`
                : '엑셀 데이터 분석 중...'}
            </p>
            {geocodingProgress && (
              <p style={{ color: '#94a3b8', fontSize: '12px' }}>
                Nominatim API 정책에 따라 초당 1건씩 안전하게 좌표로 변환합니다.
              </p>
            )}
          </div>
        ) : (
          <>
            <div style={{
              background: 'rgba(6, 182, 212, 0.1)',
              borderRadius: '50%',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Upload style={{ color: '#06b6d4', width: '32px', height: '32px' }} />
            </div>
            <div>
              <p style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                엑셀 파일을 이 영역으로 드래그하거나 클릭하세요
              </p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>
                지원 포맷: .xlsx, .xls (위도/경도가 없으면 주소로 자동 연동됩니다)
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{
          color: '#ef4444',
          fontSize: '13px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '10px',
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Sample Download Area */}
      <div style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        paddingTop: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'left'
      }}>
        <div>
          <h4 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet style={{ width: '16px', height: '16px', color: '#10b981' }} />
            엑셀 서식이 없으신가요?
          </h4>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
            샘플 포맷을 다운로드하여 데이터를 채워보세요.
          </p>
        </div>
        <button
          onClick={downloadSampleExcel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#f8fafc',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          <FileDown style={{ width: '16px', height: '16px' }} />
          샘플 받기
        </button>
      </div>
    </div>
  );
}
