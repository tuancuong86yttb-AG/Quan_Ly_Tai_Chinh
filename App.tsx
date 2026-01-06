
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Sparkles, 
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Menu,
  X,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Filter,
  ArrowRight,
  Download,
  RotateCcw,
  Palette,
  AlertTriangle,
  Database,
  CheckCircle2,
  CloudLightning,
  ExternalLink,
  Settings,
  MoreVertical,
  Bell,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Transaction, FundType, TransactionType } from './types';
import { FUND_CONFIG, FORMAT_CURRENCY } from './constants';
import { analyzeFinances } from './services/geminiService';
import { syncToSheet } from './services/sheetService';

const PRESET_COLORS = [
  '#4F46E5', // Indigo
  '#EF4444', // Red
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
];

const LOW_BALANCE_THRESHOLD = 1000000;

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('finance_data');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [fundColors, setFundColors] = useState<Record<FundType, string>>(() => {
    const saved = localStorage.getItem('fund_colors');
    if (saved) return JSON.parse(saved);
    return {
      [FundType.UNION]: '#4F46E5',
      [FundType.PARTY]: '#EF4444',
      [FundType.OFFICE]: '#10B981',
    };
  });

  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    return localStorage.getItem('google_sheet_url') || '';
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'ai' | 'settings'>('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFund, setFilterFund] = useState<FundType | 'ALL'>('ALL');
  const [activeColorPicker, setActiveColorPicker] = useState<FundType | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    fundType: FundType.UNION,
    type: TransactionType.INCOME,
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    person: ''
  });

  useEffect(() => {
    localStorage.setItem('finance_data', JSON.stringify(transactions));
    if (sheetUrl && transactions.length > 0) {
      handleSync();
    }
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('fund_colors', JSON.stringify(fundColors));
  }, [fundColors]);

  useEffect(() => {
    localStorage.setItem('google_sheet_url', sheetUrl);
  }, [sheetUrl]);

  const balances = useMemo(() => {
    const result: Record<FundType, { income: number; expense: number; total: number }> = {
      [FundType.UNION]: { income: 0, expense: 0, total: 0 },
      [FundType.PARTY]: { income: 0, expense: 0, total: 0 },
      [FundType.OFFICE]: { income: 0, expense: 0, total: 0 }
    };
    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        result[t.fundType].income += t.amount;
        result[t.fundType].total += t.amount;
      } else {
        result[t.fundType].expense += t.amount;
        result[t.fundType].total -= t.amount;
      }
    });
    return result;
  }, [transactions]);

  const totalBalance = useMemo(() => {
    return (Object.values(balances) as { total: number }[]).reduce((acc, curr) => acc + curr.total, 0);
  }, [balances]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.person.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFund = filterFund === 'ALL' || t.fundType === filterFund;
      const matchesStartDate = !startDate || t.date >= startDate;
      const matchesEndDate = !endDate || t.date <= endDate;
      return matchesSearch && matchesFund && matchesStartDate && matchesEndDate;
    });
  }, [transactions, searchTerm, filterFund, startDate, endDate]);

  // Group transactions by date for history tab
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncStatus('syncing');
    const success = await syncToSheet(sheetUrl, transactions);
    setSyncStatus(success ? 'success' : 'error');
    if (success) {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return;
    const newTx: Transaction = { ...formData, id: crypto.randomUUID() };
    setTransactions([newTx, ...transactions]);
    setShowModal(false);
    setFormData({
      fundType: FundType.UNION,
      type: TransactionType.INCOME,
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      person: ''
    });
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Xác nhận xóa giao dịch này?')) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const handleRunAi = async () => {
    if (transactions.length === 0) return;
    setIsAnalyzing(true);
    const report = await analyzeFinances(transactions);
    setAiReport(report || '');
    setIsAnalyzing(false);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterFund('ALL');
    setStartDate('');
    setEndDate('');
  };

  const updateFundColor = (fund: FundType, color: string) => {
    setFundColors(prev => ({ ...prev, [fund]: color }));
    setActiveColorPicker(null);
  };

  const chartData = (Object.entries(balances) as [FundType, { income: number; expense: number }][]).map(([key, val]) => ({
    name: FUND_CONFIG[key].label,
    'Thu': val.income,
    'Chi': val.expense,
  }));

  const pieData = (Object.entries(balances) as [FundType, { total: number }][]).map(([key, val]) => ({
    name: FUND_CONFIG[key].label,
    value: Math.max(0, val.total),
    color: fundColors[key]
  })).filter(d => d.value > 0);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900 pb-20 lg:pb-0 font-sans">
      
      {/* Refined Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transition-transform duration-300 lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center gap-3.5 mb-10">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800 leading-none">FinCorp</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Enterprise Pro</span>
            </div>
          </div>

          <nav className="space-y-1.5 flex-1">
            <SidebarLink 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              icon={<LayoutDashboard size={20} />}
              label="Bảng điều khiển"
            />
            <SidebarLink 
              active={activeTab === 'transactions'} 
              onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }}
              icon={<History size={20} />}
              label="Sổ nhật ký"
            />
            <SidebarLink 
              active={activeTab === 'ai'} 
              onClick={() => { setActiveTab('ai'); setIsSidebarOpen(false); }}
              icon={<Sparkles size={20} />}
              label="Phân tích AI"
            />
            <SidebarLink 
              active={activeTab === 'settings'} 
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              icon={<Settings size={20} />}
              label="Cấu hình hệ thống"
            />
          </nav>

          <div className="pt-6 border-t border-slate-50">
            <button 
              onClick={() => setShowModal(true)}
              className="active-scale w-full flex items-center justify-center gap-2.5 px-4 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 group"
            >
              <PlusCircle size={18} className="group-hover:rotate-90 transition-transform" />
              Thêm Giao Dịch
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-5 lg:p-10">
        {/* Modern Header */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-5">
            <div className="hidden lg:block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
                {activeTab === 'dashboard' ? 'Overview' : activeTab === 'transactions' ? 'Ledger' : activeTab === 'ai' ? 'Insights' : 'Config'}
              </p>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'transactions' && 'Nhật ký Thu Chi'}
                {activeTab === 'ai' && 'Trí tuệ Nhân tạo'}
                {activeTab === 'settings' && 'Cài đặt'}
              </h2>
            </div>
            
            {/* Responsive Mobile Title */}
            <div className="lg:hidden flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <Wallet size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">FinCorp</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {sheetUrl && (
              <div className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all bg-white shadow-sm ${
                syncStatus === 'syncing' ? 'text-amber-600 border-amber-100' :
                syncStatus === 'success' ? 'text-emerald-600 border-emerald-100' :
                syncStatus === 'error' ? 'text-rose-600 border-rose-100' :
                'text-slate-400 border-slate-100'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' :
                  syncStatus === 'success' ? 'bg-emerald-400' :
                  syncStatus === 'error' ? 'bg-rose-400' : 'bg-slate-300'
                }`} />
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Cloud Saved' : 'Cloud Status'}
              </div>
            )}
            
            <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors shadow-sm active-scale">
              <Bell size={20} />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white border border-slate-100 rounded-2xl text-slate-600 active-scale shadow-sm"
            >
              <Menu size={20} />
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {/* Dashboard Hero */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-100">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full -ml-30 -mb-30 blur-2xl"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between h-full gap-10">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 opacity-60">
                        <Wallet size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Tổng số dư khả dụng</span>
                      </div>
                      <h3 className="text-5xl font-black tracking-tight mb-2 tabular-nums">{FORMAT_CURRENCY(totalBalance)}</h3>
                      <p className="text-indigo-300 text-sm font-bold flex items-center gap-1.5">
                        <TrendingUp size={16} /> +4.2% <span className="opacity-50 font-medium">so với tháng trước</span>
                      </p>
                    </div>
                    
                    <div className="flex gap-4 mt-10">
                      <button 
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/50"
                      >
                        Thêm thu chi
                      </button>
                      <button 
                        onClick={() => setActiveTab('transactions')}
                        className="px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Xem lịch sử
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-end items-start md:items-end gap-6 md:border-l md:border-white/10 md:pl-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ArrowUpCircle size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Dòng tiền vào</p>
                        <p className="text-xl font-black text-emerald-400">+{FORMAT_CURRENCY((Object.values(balances) as { income: number }[]).reduce((a, b) => a + b.income, 0))}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                        <ArrowDownCircle size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Dòng tiền ra</p>
                        <p className="text-xl font-black text-rose-400">-{FORMAT_CURRENCY((Object.values(balances) as { expense: number }[]).reduce((a, b) => a + b.expense, 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-50 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Phân bổ Quỹ</h4>
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400 cursor-help">
                    <AlertTriangle size={14} />
                  </div>
                </div>
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {pieData.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></div>
                      <span className="text-[10px] font-bold text-slate-500 truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fund Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(Object.entries(FUND_CONFIG) as [FundType, typeof FUND_CONFIG[FundType]][]).map(([key, config]) => {
                const balance = balances[key];
                const percentage = totalBalance > 0 ? (balance.total / totalBalance) * 100 : 0;
                const currentFundColor = fundColors[key];
                const isLowBalance = balance.total < LOW_BALANCE_THRESHOLD;
                
                return (
                  <div key={key} className={`group relative bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col ${isLowBalance ? 'border-rose-100 shadow-xl shadow-rose-50' : 'border-slate-50 shadow-sm hover:shadow-xl hover:shadow-slate-100'}`}>
                    <div className="flex justify-between items-start mb-8">
                      <div 
                        className="w-14 h-14 rounded-[1.25rem] transition-transform group-hover:scale-110 duration-500 flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: `${currentFundColor}10`, color: currentFundColor }}
                      >
                        <Wallet size={24} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                         <button 
                           onClick={() => setActiveColorPicker(activeColorPicker === key ? null : key)}
                           className="p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-all active-scale"
                         >
                           <Palette size={16} />
                         </button>
                         <div 
                           className="px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-md transition-all group-hover:scale-105"
                           style={{ backgroundColor: currentFundColor }}
                         >
                           {config.label}
                         </div>
                      </div>

                      {/* Floating Color Picker */}
                      {activeColorPicker === key && (
                        <div className="absolute top-20 right-8 z-30 bg-white p-4 rounded-[2rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                           <div className="grid grid-cols-4 gap-2.5">
                             {PRESET_COLORS.map(c => (
                               <button 
                                 key={c}
                                 onClick={() => updateFundColor(key, c)}
                                 className="w-7 h-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125"
                                 style={{ backgroundColor: c }}
                               />
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-8">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Số dư hiện tại</p>
                      <div className="flex items-baseline gap-2">
                        <h4 className={`text-2xl font-black tracking-tight tabular-nums ${isLowBalance ? 'text-rose-600' : 'text-slate-800'}`}>
                          {FORMAT_CURRENCY(balance.total)}
                        </h4>
                        {isLowBalance && (
                          <div className="p-1 text-rose-500 animate-pulse">
                            <AlertTriangle size={16} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center group/item hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thu vào</p>
                          <p className="text-sm font-black text-emerald-600">+{FORMAT_CURRENCY(balance.income)}</p>
                        </div>
                        <div className="p-2 bg-white rounded-xl text-emerald-400">
                          <TrendingUp size={14} />
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center group/item hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Chi ra</p>
                          <p className="text-sm font-black text-rose-500">-{FORMAT_CURRENCY(balance.expense)}</p>
                        </div>
                        <div className="p-2 bg-white rounded-xl text-rose-400">
                          <TrendingDown size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-sm">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Thống kê Giao dịch</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">So sánh dòng tiền các quỹ</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Thu</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Chi</span>
                    </div>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} 
                      />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC', radius: 12 }} 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }} 
                      />
                      <Bar dataKey="Thu" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={40} />
                      <Bar dataKey="Chi" fill="#FB7185" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gần đây</h3>
                  <button onClick={() => setActiveTab('transactions')} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm active-scale">
                    <ArrowRight size={18} className="text-indigo-600" />
                  </button>
                </div>
                <div className="flex-1 divide-y divide-slate-50">
                  {transactions.slice(0, 6).map((t) => (
                    <div key={t.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {t.type === TransactionType.INCOME ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 truncate max-w-[120px]">{t.description}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {t.date}
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'}{FORMAT_CURRENCY(t.amount).split(',')[0]}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 grayscale opacity-40">
                      <Database size={40} className="mb-4 text-slate-300" />
                      <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Trống</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-20">
             {/* Filter Bar */}
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm flex flex-col gap-8">
               <div className="flex flex-col xl:flex-row gap-6">
                 <div className="relative flex-1">
                   <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                   <input 
                     type="text" 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Tìm kiếm nội dung, cá nhân..."
                     className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border-none rounded-[1.25rem] text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300"
                   />
                 </div>
                 
                 <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar lg:pb-0">
                   <FilterButton 
                    active={filterFund === 'ALL'} 
                    onClick={() => setFilterFund('ALL')} 
                    label="Tất cả Quỹ" 
                   />
                   {Object.entries(FUND_CONFIG).map(([key, config]) => (
                     <FilterButton 
                      key={key}
                      active={filterFund === key}
                      onClick={() => setFilterFund(key as FundType)}
                      label={config.label}
                      color={fundColors[key as FundType]}
                     />
                   ))}
                 </div>
               </div>

               <div className="flex flex-col md:flex-row items-center gap-6 pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl">
                    <Calendar size={16} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Khoảng thời gian</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                    />
                    <ArrowRight size={14} className="text-slate-300" />
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                    />
                    
                    <div className="flex gap-2 ml-auto md:ml-4">
                       <button 
                        onClick={resetFilters}
                        className="p-3 bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all active-scale"
                       >
                         <RotateCcw size={18} />
                       </button>
                       <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest active-scale">
                        <Download size={16} /> Xuất Excel
                       </button>
                    </div>
                  </div>
               </div>
             </div>

             {/* Grouped Transaction List */}
             <div className="space-y-10">
               {groupedTransactions.map(([date, items]) => (
                 <div key={date} className="animate-in fade-in slide-in-from-left-3 duration-500">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <div className="px-5 py-2 bg-white border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 shadow-sm">
                        {date === new Date().toISOString().split('T')[0] ? 'Hôm nay' : date}
                      </div>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {items.map(t => (
                        <div key={t.id} className="group bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:rotate-12 ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                              {t.type === TransactionType.INCOME ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                            </div>
                            <div>
                              <div className="text-lg font-black text-slate-800 tracking-tight">{t.description}</div>
                              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                <span 
                                  className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest text-white shadow-sm"
                                  style={{ backgroundColor: fundColors[t.fundType] }}
                                >
                                  {FUND_CONFIG[t.fundType].label}
                                </span>
                                {t.person && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                    <User size={10} /> {t.person}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between md:justify-end gap-10">
                            <div className={`text-xl font-black tabular-nums text-right ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.type === TransactionType.INCOME ? '+' : '-'}{FORMAT_CURRENCY(t.amount)}
                            </div>
                            <button 
                              onClick={() => deleteTransaction(t.id)}
                              className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active-scale"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               ))}
               
               {groupedTransactions.length === 0 && (
                 <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                   <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                     <Filter size={48} strokeWidth={1} />
                   </div>
                   <h4 className="text-xl font-black text-slate-800 tracking-tight mb-2">Không tìm thấy kết quả</h4>
                   <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm leading-relaxed mb-8">Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
                   <button onClick={resetFilters} className="px-8 py-3.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 active-scale">Làm mới bộ lọc</button>
                 </div>
               )}
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-20">
            <div className="relative overflow-hidden bg-white p-12 lg:p-16 rounded-[3.5rem] border border-slate-50 shadow-sm text-center">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 rounded-full -mr-48 -mt-48 blur-3xl opacity-50"></div>
              
              <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-3xl flex items-center justify-center mb-10 shadow-2xl shadow-indigo-200">
                  <Sparkles size={48} strokeWidth={1.5} />
                </div>
                <h3 className="text-4xl font-black text-slate-800 mb-6 tracking-tight">Financial AI Analyst</h3>
                <p className="text-slate-500 font-medium mb-12 text-lg leading-relaxed">Phân tích tình hình tài chính của đơn vị với Gemini AI. Hệ thống sẽ quét toàn bộ giao dịch để đưa ra dự báo và lời khuyên tiết kiệm ngân sách thông minh.</p>
                
                <button 
                  onClick={handleRunAi}
                  disabled={isAnalyzing || transactions.length === 0}
                  className="active-scale group w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-3.5"
                >
                  {isAnalyzing ? (
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-t-transparent" />
                      <span>Đang suy luận...</span>
                    </div>
                  ) : (
                    <>
                      Bắt đầu Phân tích
                      <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {aiReport && (
              <div className="bg-white p-12 rounded-[3.5rem] shadow-xl shadow-indigo-50 border border-slate-50 animate-in fade-in slide-in-from-bottom-10 duration-700">
                <div className="flex items-center justify-between mb-10 pb-8 border-b border-slate-50">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                       <Sparkles size={24} />
                     </div>
                     <div>
                       <h4 className="text-xl font-black text-slate-800 tracking-tight">AI Insights Report</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generated by Gemini Pro</p>
                     </div>
                   </div>
                   <button 
                    onClick={() => window.print()}
                    className="p-3.5 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-colors active-scale"
                   >
                    <Download size={22} />
                   </button>
                </div>
                <div className="prose prose-indigo max-w-none">
                  <div className="whitespace-pre-wrap leading-[2] text-slate-700 text-lg font-medium selection:bg-indigo-100">
                    {aiReport}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-20">
            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-50 shadow-sm">
              <div className="flex items-center gap-5 mb-12">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem] shadow-sm">
                  <Database size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cloud Database Sync</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Đồng bộ dữ liệu thời gian thực</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">Apps Script Web App URL</label>
                  <div className="relative">
                    <CloudLightning className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input 
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                      className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[1.5rem] outline-none focus:border-indigo-200 text-slate-700 font-bold transition-all text-sm shadow-sm"
                    />
                  </div>
                  <div className="mt-6 flex items-start gap-3 text-[11px] font-bold text-indigo-400/80 bg-white/50 p-4 rounded-2xl border border-indigo-50">
                    <AlertTriangle size={16} className="text-indigo-400 shrink-0" />
                    <p className="leading-relaxed">Dữ liệu được gửi đi dưới dạng JSON thô. Hãy đảm bảo Script của bạn đã được triển khai với quyền "Anyone" để ứng dụng có thể ghi dữ liệu.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <button 
                    onClick={handleSync}
                    disabled={!sheetUrl || syncStatus === 'syncing'}
                    className="active-scale w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    {syncStatus === 'syncing' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : <Database size={18} />}
                    Sync To Cloud
                  </button>
                  <a 
                    href="https://script.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="active-scale w-full py-5 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                  >
                    Google Scripts <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            </div>
            
            {/* Version Info Card */}
            <div className="flex justify-between items-center px-10 py-6 bg-slate-100/50 rounded-[2rem] border border-slate-100 grayscale opacity-60">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Software Version 2.4.0</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stable Build #8492</span>
            </div>
          </div>
        )}
      </main>

      {/* Refined Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-nav border-t border-slate-200/50 px-8 safe-bottom flex justify-between items-center z-50 h-24 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
        <BottomNavItem 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<LayoutDashboard size={22} />} 
          label="Tổng quan" 
        />
        <BottomNavItem 
          active={activeTab === 'transactions'} 
          onClick={() => setActiveTab('transactions')} 
          icon={<History size={22} />} 
          label="Sổ sách" 
        />
        <div className="flex-1 flex justify-center -mt-10">
          <button 
            onClick={() => setShowModal(true)}
            className="active-scale bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl shadow-slate-300 border-8 border-slate-50"
          >
            <PlusCircle size={28} strokeWidth={2.5} />
          </button>
        </div>
        <BottomNavItem 
          active={activeTab === 'ai'} 
          onClick={() => setActiveTab('ai')} 
          icon={<Sparkles size={22} />} 
          label="Gemini" 
        />
        <BottomNavItem 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings size={22} />} 
          label="Cài đặt" 
        />
      </nav>

      {/* Modern Modal Design */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-400">
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up md:animate-in md:zoom-in-95 md:duration-400">
            <div className="p-10 pb-6 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Ghi chép Thu Chi</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cập nhật biến động số dư</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl active-scale transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-10 space-y-8">
              {/* Transaction Type Toggle */}
              <div className="flex p-2 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: TransactionType.INCOME})}
                  className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${formData.type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                >
                  <TrendingUp size={14} /> Thu vào (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})}
                  className={`flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${formData.type === TransactionType.EXPENSE ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}
                >
                  <TrendingDown size={14} /> Chi ra (-)
                </button>
              </div>

              {/* Amount Display */}
              <div className="text-center py-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 focus-within:border-indigo-100 transition-all">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 block">Số tiền giao dịch</label>
                <div className="flex items-center justify-center gap-2">
                   <input 
                    type="number" 
                    required
                    autoFocus
                    value={formData.amount === 0 ? '' : formData.amount}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    placeholder="0"
                    className="w-full bg-transparent text-center text-6xl font-black text-slate-900 placeholder-slate-200 outline-none tabular-nums"
                  />
                  <span className="text-2xl font-black text-slate-300">₫</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Phân loại Quỹ</label>
                  <div className="relative">
                    <select 
                      value={formData.fundType}
                      onChange={(e) => setFormData({...formData, fundType: e.target.value as FundType})}
                      className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 appearance-none cursor-pointer"
                    >
                      <option value={FundType.UNION}>CÔNG ĐOÀN</option>
                      <option value={FundType.PARTY}>ĐẢNG PHÍ</option>
                      <option value={FundType.OFFICE}>VĂN PHÒNG</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Lý do / Diễn giải</label>
                <input 
                  type="text" 
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Ví dụ: Mua sắm vật tư quý I..."
                  className="w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 font-bold transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Đối tượng (Cá nhân/Tổ chức)</label>
                <div className="relative">
                  <User size={18} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text" 
                    value={formData.person}
                    onChange={(e) => setFormData({...formData, person: e.target.value})}
                    placeholder="Nhập tên đối tượng..."
                    className="w-full pl-16 pr-7 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 font-bold transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-5 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="active-scale flex-1 py-5 bg-slate-100 text-slate-500 rounded-[1.75rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="active-scale flex-[2] py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarLink: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[13px] font-extrabold transition-all active-scale group
      ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}
    `}
  >
    <span className={`${active ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'} transition-colors`}>{icon}</span>
    {label}
  </button>
);

const FilterButton: React.FC<{ active: boolean; onClick: () => void; label: string; color?: string }> = ({ active, onClick, label, color }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 active-scale ${active ? 'shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
    style={{ 
      backgroundColor: active ? (color || '#4F46E5') : undefined,
      borderColor: active ? (color || '#4F46E5') : 'transparent',
      color: active ? '#FFF' : undefined,
      boxShadow: active ? `0 10px 20px -5px ${color || '#4F46E5'}40` : undefined
    }}
  >
    {label}
  </button>
);

const BottomNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1.5 flex-1 transition-all active-scale ${active ? 'text-indigo-600' : 'text-slate-300'}`}
  >
    <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-indigo-50' : ''}`}>
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

export default App;
