
import React from 'react';
import { FundType } from './types';

export const FUND_CONFIG = {
  [FundType.UNION]: {
    label: 'Công đoàn',
    color: 'blue',
    bg: 'bg-blue-600',
    lightBg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200'
  },
  [FundType.PARTY]: {
    label: 'Đảng phí',
    color: 'red',
    bg: 'bg-red-600',
    lightBg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200'
  },
  [FundType.OFFICE]: {
    label: 'Văn phòng',
    color: 'emerald',
    bg: 'bg-emerald-600',
    lightBg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200'
  }
};

export const FORMAT_CURRENCY = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
