import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  History, 
  Sparkles, 
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Filter,
  Download,
  RotateCcw,
  Palette,
  AlertCircle,
  Database,
  CheckCircle2,
  Settings,
  Menu,
  ChevronRight,
  ExternalLink,
  Github,
  Bell
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
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

const LOW_BALANCE_THRESHOLD = 1000000;

const App: React.FC = () => {
  // Persistence
  const [transactions, setTransactions] = useState<Transaction[]>((() => {
    const saved = localStorage.getItem('fincorp_data');
    return saved ? JSON.parse(saved) : [];
  }));
  
  const [fundColors, setFundColors] = useState<Record<FundType, string>>(() => {
    const saved = localStorage.getItem('fincorp_colors');
    if (saved) return JSON.parse(saved);
    return {
      [FundType.UNION]: '#6366f1',
      [FundType.PARTY]: '#ef4444',
      [FundType.OFFICE]: '#10b981',
    };
  });

  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem('fincorp_sheet_url') || '');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'ai' | 'settings'>('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Analysis & Search
  const [aiReport, setAiReport] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFund, setFilterFund] = useState<FundType | 'ALL'>('ALL');
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

  // Effects
  useEffect(() => {
    localStorage.setItem('fincorp_data', JSON.stringify(transactions));
    if (sheetUrl && transactions.length > 0) handleSync();
  }, [transactions]);

  useEffect(() => localStorage.setItem('fincorp_colors', JSON.stringify(fundColors)), [fundColors]);
  useEffect(() => localStorage.setItem('fincorp_sheet_url', sheetUrl), [sheetUrl]);

  // Calculations
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

  const totalBalance = useMemo(() => 
    (Object.values(balances) as { total: number }[]).reduce((acc, curr) => acc + curr.total, 0), [balances]);

  const filteredTransactions = useMemo(() => 
    transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.person.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFund = filterFund === 'ALL' || t.fundType === filterFund;
      const matchesDate = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
      return matchesSearch && matchesFund && matchesDate;
    }), [transactions, searchTerm, filterFund, startDate, endDate]);

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncStatus('syncing');
    const success = await syncToSheet(sheetUrl, transactions);
    setSyncStatus(success ? 'success' : 'error');
    if (success) setTimeout(() => setSyncStatus('idle'), 3000);
  };

  // Add handleRunAi function to process financial data analysis with Gemini API
  const handleRunAi = async () => {
    if (transactions.length === 0) return;
    setIsAnalyzing(true);
    setAiReport('');
    try {
      const report = await analyzeFinances(transactions);
      setAiReport(report || 'Không có dữ liệu phản hồi từ AI.');
    } catch (error) {
      console.error("Analysis error:", error);
      setAiReport("Đã xảy ra lỗi khi kết nối với Gemini. Vui lòng kiểm tra lại cấu hình.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return;
    const newTx: Transaction = { ...formData, id: crypto.randomUUID() };
    setTransactions([newTx, ...transactions]);
    setShowModal(false);
    setFormData({ fundType: FundType.UNION, type: TransactionType.INCOME, amount: 0, description: '', date: new Date().toISOString().split('T')[0], person: '' });
  };

  const deleteTransaction = (id: string) => {
    if (confirm('Xóa giao dịch này?')) setTransactions(transactions.filter(t => t.id !== id));
  };

  const chartData = useMemo(() => {
    // Group transactions by date for a trend area chart
    const days: Record<string, { date: string, income: number, expense: number }> = {};
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(day => days[day] = { date: day.split('-').slice(1).join('/'), income: 0, expense: 0 });
    
    transactions.forEach(t => {
      if (days[t.date]) {
        if (t.type === TransactionType.INCOME) days[t.date].income += t.amount;
        else days[t.date].expense += t.amount;
      }
    });
    return Object.values(days);
  }, [transactions]);

  const pieData = (Object.entries(balances) as [FundType, { total: number }][]).map(([key, val]) => ({
    name: FUND_CONFIG[key].label,
    value: Math.max(0, val.total),
    color: fundColors[key]
  })).filter(d => d.value > 0);

  // Suggestions for autocomplete
  const suggestionData = useMemo(() => {
    const descriptions = Array.from(new Set(transactions.map(t => t.description))).filter(Boolean);
    const persons = Array.from(new Set(transactions.map(t => t.person))).filter(Boolean);
    return { descriptions, persons };
  }, [transactions]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      
      {/* Sidebar - Modern Design */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none">FinCorp Pro</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Finance Manager</span>
            </div>
          </div>

          <nav className="space-y-1.5 flex-1">
            <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} icon={<LayoutDashboard size={20} />} label="Tổng quan" />
            <NavItem active={activeTab === 'transactions'} onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }} icon={<History size={20} />} label="Sổ nhật ký" />
            <NavItem active={activeTab === 'ai'} onClick={() => { setActiveTab('ai'); setIsSidebarOpen(false); }} icon={<Sparkles size={20} />} label="Phân tích Gemini" />
            <NavItem active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} icon={<Settings size={20} />} label="Cài đặt dự án" />
          </nav>

          <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
             <button 
              onClick={() => setShowModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl active-scale"
            >
              <Plus size={18} /> Ghi giao dịch
            </button>
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Sync Status</span>
              <div className={`w-2 h-2 rounded-full ${syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-72 bg-[#F8FAFC]">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={18} />
            </div>
            <span className="font-bold text-slate-900">FinCorp</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 active-scale">
            <Menu size={24} />
          </button>
        </header>

        {/* Dynamic Viewport */}
        <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 lg:pb-10">
          
          {/* Header Title Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Dành cho tổ chức đoàn thể</p>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? 'Chào buổi sáng!' : activeTab === 'transactions' ? 'Nhật ký Thu Chi' : activeTab === 'ai' ? 'Trợ lý Gemini Pro' : 'Thiết lập Dự án'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm active-scale">
                <Bell size={20} />
              </button>
              <div className="h-10 w-px bg-slate-200 mx-1 hidden md:block"></div>
              <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 leading-none">Quản trị viên</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Online</p>
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in">
              {/* Main Balance Hero Card */}
              <div className="xl:col-span-2 space-y-8">
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse"></div>
                  <div className="relative z-10 flex flex-col md:flex-row justify-between h-full gap-8">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-100 mb-2 opacity-80">Tổng ngân quỹ khả dụng</p>
                      <h3 className="text-5xl font-black tracking-tight tabular-nums mb-6">{FORMAT_CURRENCY(totalBalance)}</h3>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl backdrop-blur-md">
                          <TrendingUp size={14} className="text-emerald-300" />
                          <span className="text-xs font-bold text-emerald-300">Dòng tiền ổn định</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-end gap-6 md:border-l md:border-white/10 md:pl-8">
                      <div className="space-y-1">
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">Tổng thu vào</p>
                        <p className="text-xl font-black text-emerald-300">+{FORMAT_CURRENCY((Object.values(balances) as { income: number }[]).reduce((a, b) => a + b.income, 0))}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">Tổng chi ra</p>
                        <p className="text-xl font-black text-rose-300">-{FORMAT_CURRENCY((Object.values(balances) as { expense: number }[]).reduce((a, b) => a + b.expense, 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fund Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {(Object.entries(FUND_CONFIG) as [FundType, typeof FUND_CONFIG[FundType]][]).map(([key, config]) => {
                    const balance = balances[key];
                    const color = fundColors[key];
                    const isLow = balance.total < LOW_BALANCE_THRESHOLD;
                    return (
                      <div key={key} className={`group bg-white p-6 rounded-[2rem] border-2 transition-all ${isLow ? 'border-rose-100 shadow-rose-50' : 'border-transparent shadow-sm hover:shadow-xl hover:border-indigo-50'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${color}15`, color: color }}>
                            <Wallet size={20} />
                          </div>
                          <div className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: color }}>
                            {config.label}
                          </div>
                        </div>
                        <h4 className={`text-xl font-black mb-1 tabular-nums ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{FORMAT_CURRENCY(balance.total)}</h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái:</span>
                          <span className={`text-[10px] font-black uppercase ${isLow ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>
                            {isLow ? 'Số dư thấp' : 'An toàn'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Charts/Recent */}
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Biểu đồ Phân bổ</h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={55} outerRadius={75} paddingAngle={8} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-6">
                    {pieData.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></div>
                          <span className="text-[10px] font-bold text-slate-500">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-900">{Math.round((p.value / totalBalance) * 100) || 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Gần đây</h4>
                    <button onClick={() => setActiveTab('transactions')} className="text-indigo-600 active-scale"><ChevronRight size={18} /></button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {transactions.slice(0, 4).map(t => (
                      <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                            {t.type === TransactionType.INCOME ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          </div>
                          <div className="max-w-[100px]">
                            <p className="text-[11px] font-bold text-slate-800 truncate leading-none mb-1">{t.description}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{t.date}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'}{FORMAT_CURRENCY(t.amount).split(',')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filters & Actions */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-6">
                <div className="relative flex-1 group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input 
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm nội dung, đối tượng..."
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold text-sm"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
                  <FilterTab active={filterFund === 'ALL'} label="Tất cả" onClick={() => setFilterFund('ALL')} />
                  {Object.entries(FUND_CONFIG).map(([key, config]) => (
                    <FilterTab key={key} active={filterFund === key} label={config.label} color={fundColors[key as FundType]} onClick={() => setFilterFund(key as FundType)} />
                  ))}
                </div>
              </div>

              {/* Transactions Table/List */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-6">Thời gian</th>
                        <th className="px-8 py-6">Diễn giải</th>
                        <th className="px-8 py-6">Quỹ</th>
                        <th className="px-8 py-6">Đối tượng</th>
                        <th className="px-8 py-6 text-right">Số tiền</th>
                        <th className="px-8 py-6 text-center">Tác vụ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="group hover:bg-indigo-50/30 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-400 tabular-nums">{t.date}</td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3 font-bold text-sm text-slate-800">
                              <div className={`p-1.5 rounded-lg ${t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                {t.type === TransactionType.INCOME ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                              </div>
                              {t.description}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: fundColors[t.fundType] }}>
                              {FUND_CONFIG[t.fundType].label}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-xs font-medium text-slate-500 italic">{t.person || '-'}</td>
                          <td className={`px-8 py-5 text-sm font-black text-right tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'}{FORMAT_CURRENCY(t.amount)}
                          </td>
                          <td className="px-8 py-5 text-center">
                            <button onClick={() => deleteTransaction(t.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active-scale opacity-0 group-hover:opacity-100">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredTransactions.length === 0 && (
                    <div className="py-24 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                        <Filter size={32} />
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Không tìm thấy giao dịch nào</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-slate-900 rounded-[3rem] p-12 text-center text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full -mr-48 -mt-48 blur-3xl"></div>
                <div className="relative z-10">
                  <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Sparkles size={40} />
                  </div>
                  <h3 className="text-3xl font-black mb-4 tracking-tight">AI Financial Expert</h3>
                  <p className="text-slate-400 max-w-lg mx-auto mb-10 text-lg leading-relaxed font-medium">Hãy để Gemini phân tích dữ liệu và cung cấp cái nhìn sâu sắc về tình hình tài chính của bạn ngay lập tức.</p>
                  <button 
                    onClick={handleRunAi} disabled={isAnalyzing || transactions.length === 0}
                    className="w-full max-w-sm py-5 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-50 transition-all active-scale flex items-center justify-center gap-3"
                  >
                    {isAnalyzing ? <div className="animate-spin rounded-full h-5 w-5 border-3 border-indigo-600 border-t-transparent" /> : <Sparkles size={20} />}
                    {isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu phân tích'}
                  </button>
                </div>
              </div>

              {aiReport && (
                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 prose prose-slate max-w-none">
                  <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-50">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Sparkles size={20} /></div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest m-0">Báo cáo phân tích thông minh</h4>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-700 font-medium">{aiReport}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><Database size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Cấu hình Cloud Sync</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Lưu trữ dữ liệu lên Google Sheets</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">Apps Script URL</label>
                    <input 
                      type="url" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                      className="w-full px-6 py-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-700 font-bold transition-all text-sm shadow-sm"
                    />
                    <div className="mt-4 p-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-bold italic flex items-center gap-2">
                      <AlertCircle size={14} /> Dữ liệu sẽ tự động đồng bộ khi bạn thay đổi giao dịch.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={handleSync} disabled={!sheetUrl || syncStatus === 'syncing'} className="flex items-center justify-center gap-2 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all active-scale">
                      {syncStatus === 'syncing' ? 'Đang gửi...' : 'Đồng bộ thủ công'}
                    </button>
                    <a href="https://github.com" target="_blank" className="flex items-center justify-center gap-2 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active-scale">
                      <Github size={18} /> View on GitHub
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-10 bg-indigo-600 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl shadow-indigo-100">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 text-center md:text-left">
                  <h4 className="text-2xl font-black mb-2 tracking-tight">Cần trợ giúp thiết lập?</h4>
                  <p className="text-indigo-100 font-medium opacity-80">Xem tài liệu hướng dẫn triển khai trên GitHub và kết nối Google Sheets tại đây.</p>
                </div>
                <button className="relative z-10 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-50 transition-all active-scale whitespace-nowrap">
                  Hướng dẫn sử dụng
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modern Modal Design */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up sm:animate-none">
            <div className="p-8 pb-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800">Ghi giao dịch</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vui lòng điền đủ các mục</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 text-slate-400 hover:text-rose-500 transition-all active-scale"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: TransactionType.INCOME})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>THU VÀO</button>
                <button type="button" onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === TransactionType.EXPENSE ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>CHI RA</button>
              </div>

              <div className="text-center py-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group focus-within:border-indigo-200 transition-all">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Số tiền (₫)</label>
                <input 
                  type="number" required autoFocus value={formData.amount === 0 ? '' : formData.amount}
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  placeholder="0" className="w-full bg-transparent text-center text-5xl font-black text-slate-900 outline-none tabular-nums placeholder-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quỹ thụ hưởng</label>
                  <select value={formData.fundType} onChange={e => setFormData({...formData, fundType: e.target.value as FundType})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 appearance-none">
                    <option value={FundType.UNION}>CÔNG ĐOÀN</option>
                    <option value={FundType.PARTY}>ĐẢNG PHÍ</option>
                    <option value={FundType.OFFICE}>VĂN PHÒNG</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày tháng</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung chi tiết</label>
                <input 
                  type="text" 
                  required 
                  list="desc-suggestions"
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="Nhập lý do thu/chi..." 
                  className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 font-bold" 
                />
                <datalist id="desc-suggestions">
                  {suggestionData.descriptions.map(desc => <option key={desc} value={desc} />)}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đối tượng thực hiện</label>
                <input 
                  type="text" 
                  list="person-suggestions"
                  value={formData.person} 
                  onChange={e => setFormData({...formData, person: e.target.value})} 
                  placeholder="Tên cá nhân/đơn vị..." 
                  className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 font-bold" 
                />
                <datalist id="person-suggestions">
                  {suggestionData.persons.map(person => <option key={person} value={person} />)}
                </datalist>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all active-scale">Đóng</button>
                <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active-scale">Lưu giao dịch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all active-scale ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
    <span className={active ? 'text-white' : 'text-slate-300'}>{icon}</span>
    {label}
  </button>
);

const FilterTab: React.FC<{ active: boolean; label: string; onClick: () => void; color?: string }> = ({ active, label, onClick, color }) => (
  <button 
    onClick={onClick} 
    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 active-scale ${active ? 'shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
    style={{ backgroundColor: active ? (color || '#6366f1') : undefined, borderColor: active ? (color || '#6366f1') : 'transparent', color: active ? 'white' : undefined }}
  >
    {label}
  </button>
);

export default App;