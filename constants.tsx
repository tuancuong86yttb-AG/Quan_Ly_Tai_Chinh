import React from 'react';
import { FundType } from './types';

export const FUND_CONFIG = {
  [FundType.UNION]: {
    label: 'Công đoàn',
    color: '#6366f1',
    bg: 'bg-indigo-600',
    lightBg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-200'
  },
  [FundType.PARTY]: {
    label: 'Đảng phí',
    color: '#ef4444',
    bg: 'bg-red-600',
    lightBg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200'
  },
  [FundType.OFFICE]: {
    label: 'Văn phòng',
    color: '#10b981',
    bg: 'bg-emerald-600',
    lightBg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200'
  }
};

export const FORMAT_CURRENCY = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { 
    style: 'currency', 
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
};