/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Calendar, 
  Award, 
  UploadCloud, 
  Mic, 
  Headphones, 
  Settings, 
  ChevronDown, 
  Search, 
  Bell, 
  Pin, 
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { read, utils } from "xlsx";

type TabType = "participants" | "events" | "exams" | "upload";

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  email?: string;
  phone?: string;
  attendances: {
    id: string;
    event: {
      id: string;
      name: string;
      date: string;
      location?: string;
    };
  }[];
  examResults: {
    id: string;
    score: number;
    status: string; // "Geçti" | "Kaldı"
    exam: {
      id: string;
      name: string;
      passingScore: number;
      event: {
        id: string;
        name: string;
      };
    };
  }[];
}

interface EventData {
  id: string;
  name: string;
  date: string;
  location?: string;
  exams: {
    id: string;
    name: string;
    passingScore: number;
  }[];
  attendances: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      company?: string;
    };
  }[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("participants");
  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail panel state
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  // Editing scores inside drawer
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editScoreValue, setEditScoreValue] = useState<number>(0);

  // Re-assigning exam form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [newExamName, setNewExamName] = useState("");
  const [newExamPassingScore, setNewExamPassingScore] = useState(70);

  // File uploading state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch real data from the Express backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, eventsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/events")
      ]);
      
      if (usersRes.ok && eventsRes.ok) {
        const usersData = await usersRes.json();
        const eventsData = await eventsRes.json();
        setUsers(usersData);
        setEvents(eventsData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Search filtering
  const filteredUsers = users.filter(user => 
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.company && user.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.location && event.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadStatusMsg("");
    setUploadProgress(10);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        setUploadProgress(40);
        const data = e.target?.result;
        const workbook = read(data, { type: "binary" });
        setUploadProgress(70);
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = utils.sheet_to_json(worksheet);
        
        setUploadProgress(90);
        setParsedRows(json);
        setUploadProgress(100);
        setUploadStatusMsg(`${file.name} başarıyla çözümlendi! Aşağıdaki tablodan veriyi inceleyip kaydedebilirsiniz.`);
        
        setTimeout(() => {
          setUploadProgress(null);
        }, 1500);
      } catch (err) {
        console.error("Error reading file:", err);
        setUploadProgress(null);
        setUploadStatusMsg("Hata: Excel dosyası okunamadı. Lütfen geçerli bir dosya yükleyin.");
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // Save imported rows to database
  const saveImportedData = async () => {
    if (parsedRows.length === 0) return;
    try {
      setLoading(true);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows })
      });
      
      if (response.ok) {
        const result = await response.json();
        setUploadStatusMsg(`Başarılı! ${result.count} satır veri veri tabanına işlendi.`);
        setParsedRows([]);
        fetchData();
        setActiveTab("participants");
      } else {
        setUploadStatusMsg("Hata: Sunucuya veri kaydı başarısız oldu.");
      }
    } catch (error) {
      console.error("Save import error:", error);
      setUploadStatusMsg("Hata: Veritabanına bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  // Update specific score from drawer
  const saveScoreChange = async (examId: string) => {
    if (!selectedUser) return;
    try {
      const response = await fetch("/api/update-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          examId,
          score: editScoreValue
        })
      });

      if (response.ok) {
        // Refresh local users list
        const updatedUser = await response.json();
        // Update user selection with updated score
        const updatedUsersListRes = await fetch("/api/users");
        if (updatedUsersListRes.ok) {
          const freshUsers = await updatedUsersListRes.json();
          setUsers(freshUsers);
          const found = freshUsers.find((u: any) => u.id === selectedUser.id);
          if (found) setSelectedUser(found);
        }
        setEditingScoreId(null);
      }
    } catch (error) {
      console.error("Failed to update score:", error);
    }
  };

  // Add/Assign new exam to event of the user
  const handleAssignExam = async (eventId: string) => {
    if (!selectedUser || !newExamName) return;
    try {
      const response = await fetch("/api/assign-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          eventId,
          examName: newExamName,
          passingScore: newExamPassingScore
        })
      });

      if (response.ok) {
        // Refresh
        const updatedUsersListRes = await fetch("/api/users");
        if (updatedUsersListRes.ok) {
          const freshUsers = await updatedUsersListRes.json();
          setUsers(freshUsers);
          const found = freshUsers.find((u: any) => u.id === selectedUser.id);
          if (found) setSelectedUser(found);
        }
        setShowAssignForm(false);
        setNewExamName("");
      }
    } catch (error) {
      console.error("Error assigning exam:", error);
    }
  };

  return (
    <div id="discord-app" className="flex h-screen w-screen overflow-hidden bg-[#1e1f22] text-[#dbdee1] select-none font-sans">
      
      {/* 1. SIDEBAR (Yan Panel) */}
      <aside id="sidebar" className="w-64 flex flex-col bg-[#2b2d31] h-full border-r border-[#1e1f22] flex-shrink-0 z-10">
        
        {/* Sidebar Header with Sleek Interface Theme */}
        <div className="h-16 border-b border-[#1e1f22] flex items-center justify-between px-5 font-bold text-base cursor-pointer hover:bg-[#36373d]/50 transition-colors shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5865f2] flex items-center justify-center text-white font-bold shadow-md shadow-[#5865f2]/20">
              TP
            </div>
            <span className="text-white font-bold tracking-tight text-md">TP-Link Academy</span>
          </div>
          <ChevronDown className="w-4 h-4 text-[#b5bac1]" />
        </div>

        {/* Navigation Channels */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-[4px]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-3">
            Eğitim Yönetimi
          </div>

          <button
            onClick={() => { setActiveTab("participants"); setSelectedEvent(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              activeTab === "participants" 
                ? "active-nav font-semibold" 
                : "text-[#b5bac1] discord-hover"
            }`}
          >
            <Users className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
            <span>Katılımcılar</span>
          </button>

          <button
            onClick={() => { setActiveTab("events"); setSelectedUser(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              activeTab === "events" 
                ? "active-nav font-semibold" 
                : "text-[#b5bac1] discord-hover"
            }`}
          >
            <Calendar className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
            <span>Etkinlikler</span>
          </button>

          <button
            onClick={() => { setActiveTab("exams"); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              activeTab === "exams" 
                ? "active-nav font-semibold" 
                : "text-[#b5bac1] discord-hover"
            }`}
          >
            <Award className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
            <span>Sınavlar</span>
          </button>

          <div className="pt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-3">
              Veri İşlemleri
            </div>
            <button
              onClick={() => setActiveTab("upload")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                activeTab === "upload" 
                  ? "active-nav font-semibold" 
                  : "text-[#b5bac1] discord-hover"
              }`}
            >
              <UploadCloud className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
              <span className="flex items-center justify-between w-full">
                <span>Excel Yükle</span>
                <span className="text-[9px] bg-[#5865f2] px-1.5 py-0.5 rounded text-white font-bold">XLSX</span>
              </span>
            </button>
          </div>
        </nav>

        {/* User Card from Sleek Interface template */}
        <div className="mt-auto p-4 bg-[#313338] mx-3 mb-6 rounded-lg flex items-center gap-3 border border-[#1e1f22] shadow-md hover:border-[#5865f2]/20 transition-all duration-300">
          <div className="w-10 h-10 rounded-full bg-[#5865f2]/20 border border-[#5865f2]/30 flex items-center justify-center text-[#5865f2] font-bold text-sm">
            SB
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-white truncate">Sercan Bozkan</p>
            <p className="text-[10px] text-[#b5bac1] truncate">System Admin</p>
          </div>
          <div className="flex gap-1">
            <button className="p-1 rounded text-[#b5bac1] hover:text-white hover:bg-[#36373d] transition-all">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </aside>

      {/* MAIN CONTAINER AREA */}
      <main id="main-content" className="flex-1 flex flex-col h-full bg-[#1e1f22] overflow-hidden relative">
        
        {/* 2. HEADER */}
        <header className="h-16 flex items-center justify-between px-8 bg-[#1e1f22] border-b border-[#2b2d31] flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 text-white font-semibold text-lg">
            <span>
              {activeTab === "participants" && "Katılımcı Yönetimi"}
              {activeTab === "events" && "Etkinlik Planlama"}
              {activeTab === "exams" && "Sertifika & Sınavlar"}
              {activeTab === "upload" && "Akıllı Excel Sihirbazı"}
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-[#b5bac1] font-normal text-sm flex items-center gap-1.5">
              {activeTab === "participants" && `${users.length} Toplam Kayıt`}
              {activeTab === "events" && `${events.length} Aktif Eğitim`}
              {activeTab === "exams" && "Puan Baremleri"}
              {activeTab === "upload" && "Sürükle-bırak excel aktarımı"}
              
              <button 
                onClick={handleRefresh}
                title="Yenile"
                className={`p-1 rounded hover:bg-[#36373d] text-[#b5bac1] hover:text-white transition-all ${isRefreshing ? 'animate-spin text-[#5865f2]' : ''}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Elegant Search bar matching Sleek theme */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="İsim, mail veya kurum ara..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#1e1f22] border border-[#2b2d31] rounded-md px-4 py-1.5 pl-9 text-sm focus:outline-none focus:border-[#5865f2] w-64 text-white placeholder-gray-500 transition-all duration-300"
              />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            </div>

            <button 
              onClick={() => { setActiveTab("upload"); }}
              className="bg-[#5865f2] text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 anti-gravity hover:shadow-lg hover:shadow-[#5865f2]/20"
            >
              <Plus className="w-4 h-4" /> Yeni Katılımcı / Excel
            </button>
          </div>
        </header>

        {/* 3. WORKSPACE AREA */}
        <section className="flex-1 overflow-y-auto p-8 relative pb-28">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-6"
            >
              
              {/* TOP FLIGHT STATISTICS CARDS (Bento Grid styling with custom anti-gravity shadows) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#5865f2]/5 rounded-full blur-xl group-hover:bg-[#5865f2]/10 transition-colors duration-300"></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aktif Katılımcılar</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{users.length}</span>
                    <span className="text-[10px] text-green-400 font-semibold bg-green-500/10 px-1.5 py-0.5 rounded">+%12 geçen aydan beri</span>
                  </div>
                  <span className="text-xs text-[#b5bac1] mt-1">Sertifika almaya hak kazanmış veya eğitimde olanlar</span>
                </div>

                <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#5865f2]/5 rounded-full blur-xl group-hover:bg-[#5865f2]/10 transition-colors duration-300"></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tamamlanan Sınavlar</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      {users.reduce((acc, u) => acc + (u.examResults?.length || 0), 0)}
                    </span>
                    <span className="text-[10px] text-[#5865f2] font-semibold bg-[#5865f2]/10 px-1.5 py-0.5 rounded">Toplam Sertifika</span>
                  </div>
                  <span className="text-xs text-[#b5bac1] mt-1">Akademi sınavlarında başarı sağlayanlar</span>
                </div>

                <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Başarı Oranı</span>
                  <span className="text-3xl font-bold text-white">
                    {users.length > 0 ? (
                      (users.reduce((acc, u) => {
                        const passed = u.examResults.filter(r => r.status === "Geçti").length;
                        const total = u.examResults.length;
                        return acc + (total > 0 ? (passed / total) : 0);
                      }, 0) / users.length * 100).toFixed(1)
                    ) : "88.4"}%
                  </span>
                  <div className="w-full bg-[#1e1f22] h-2 mt-2 rounded-full overflow-hidden">
                    <div className="bg-[#5865f2] h-full rounded-full transition-all duration-1000" style={{ width: "88%" }}></div>
                  </div>
                </div>

              </div>

              {/* TAB CONTENTS */}
              {activeTab === "participants" && (
                <div className="bg-[#313338] rounded-lg flex flex-col anti-gravity overflow-hidden border border-[#36373d]/40">
                  <div className="p-5 border-b border-[#1e1f22] bg-[#2b2d31]/30 flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-bold text-base">Güncel Katılımcı Listesi</h3>
                      <p className="text-xs text-gray-500">Katılımcıların detaylarını, katıldıkları eğitimleri ve sınav notlarını görmek için satıra tıklayın.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-[#2b2d31] text-[10px] px-3 py-1 rounded border border-[#1e1f22] text-[#b5bac1] font-semibold">
                        Görünüm: Akışkan Tablo
                      </span>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <div className="w-12 h-12 border-4 border-[#5865f2] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-400">Veritabanı bağlantısı kuruluyor...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#1e1f22] flex items-center justify-center text-[#949ba4]">
                        <Users className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-lg">Katılımcı Verisi Bulunamadı</h4>
                        <p className="text-xs text-gray-500 max-w-sm mt-1">
                          Arama terimiyle eşleşen sonuç yok veya sisteme henüz veri yüklenmemiş.
                        </p>
                      </div>
                      <button 
                        onClick={() => setActiveTab("upload")}
                        className="bg-[#5865f2] text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-[#5865f2]/90 transition-all shadow-md shadow-[#5865f2]/20"
                      >
                        Excel ile Toplu Yükle
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#1e1f22] text-[11px] uppercase font-bold text-gray-500">
                          <tr>
                            <th className="px-6 py-4">Katılımcı</th>
                            <th className="px-6 py-4">Kurum / Şube</th>
                            <th className="px-6 py-4">Son Eğitim</th>
                            <th className="px-6 py-4">Durum</th>
                            <th className="px-6 py-4 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300 divide-y divide-[#1e1f22]">
                          {filteredUsers.map((user) => {
                            const lastAttendance = user.attendances?.[user.attendances.length - 1]?.event?.name || "Giriş Seviyesi";
                            const overallPassed = user.examResults?.length > 0 && user.examResults.every(r => r.status === "Geçti");
                            const hasFailed = user.examResults?.some(r => r.status === "Kaldı");
                            
                            let statusBadge = (
                              <span className="px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase">
                                EĞİTİMDE
                              </span>
                            );
                            if (overallPassed) {
                              statusBadge = (
                                <span className="px-2.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase">
                                  SERTİFİKALI
                                </span>
                              );
                            } else if (hasFailed) {
                              statusBadge = (
                                <span className="px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20 uppercase">
                                  KALDI
                                </span>
                              );
                            }

                            const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "TP";

                            return (
                              <tr 
                                key={user.id} 
                                onClick={() => setSelectedUser(user)}
                                className="discord-hover transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-[#5865f2]/20">
                                    {initials}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium group-hover:text-[#5865f2] transition-colors">{user.firstName} {user.lastName}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{user.email || "e-posta tanımlanmamış"}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-[#dbdee1]">{user.company || "Serbest / Tanımsız"}</td>
                                <td className="px-6 py-4 font-mono text-[12px] text-[#b5bac1]">{lastAttendance}</td>
                                <td className="px-6 py-4">{statusBadge}</td>
                                <td className="px-6 py-4 text-right">
                                  <button className="text-gray-500 hover:text-white font-semibold text-xs group-hover:text-white group-hover:translate-x-[-2px] transition-all flex items-center gap-1 ml-auto">
                                    Detay <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "events" && (
                <div className="space-y-6">
                  <div className="bg-[#313338] rounded-lg p-5 border border-[#36373d]/40 anti-gravity">
                    <h3 className="text-white font-bold text-base mb-2">Aktif Eğitim Etkinlikleri</h3>
                    <p className="text-xs text-gray-500 mb-6">Farklı tarihlerde düzenlenen eğitimler, katılım sayıları ve ilişkili sınav geçme baremleri.</p>

                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-10 h-10 border-4 border-[#5865f2] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 text-sm">
                        Kayıtlı etkinlik bulunamadı.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredEvents.map((event) => (
                          <div 
                            key={event.id}
                            className="bg-[#2b2d31] border border-[#36373d] rounded-lg p-5 hover:border-[#5865f2]/40 hover:-translate-y-1 transition-all duration-300 relative group"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="text-white font-bold text-base group-hover:text-[#5865f2] transition-colors">{event.name}</h4>
                              <span className="text-[10px] bg-[#5865f2]/10 text-[#5865f2] font-bold px-2 py-0.5 rounded border border-[#5865f2]/20">
                                ETKİNLİK
                              </span>
                            </div>

                            <div className="space-y-2 mb-4 text-xs text-gray-400">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                <span>{new Date(event.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                                <span>{event.location || "Online Zoom Portalı"}</span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-[#1e1f22] flex justify-between items-center text-xs">
                              <span className="text-gray-500">Katılımcı Sayısı: <strong className="text-white">{event.attendances?.length || 0} kişi</strong></span>
                              <span className="text-[#5865f2] font-semibold">{event.exams?.length || 0} Sınav Tanımlı</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "exams" && (
                <div className="bg-[#313338] rounded-lg p-6 border border-[#36373d]/40 anti-gravity">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">Sertifika Sınavları & Geçme Notları</h3>
                      <p className="text-xs text-gray-500">TP-Link Akademi bünyesindeki aktif sınavlar ve belirlenen asgari puan limitleri.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#36373d] space-y-2">
                      <span className="text-[10px] bg-green-500/10 text-green-400 font-bold px-2 py-0.5 rounded uppercase border border-green-500/20">Omada SDN Expert</span>
                      <h4 className="text-white font-bold text-sm">Geçme Notu: 75</h4>
                      <p className="text-xs text-gray-500">Omada bulut denetleyicileri ve profesyonel ağ kurulumu sınavı.</p>
                    </div>
                    <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#36373d] space-y-2">
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded uppercase border border-blue-500/20">VIGI VMS Pro 2.0</span>
                      <h4 className="text-white font-bold text-sm">Geçme Notu: 70</h4>
                      <p className="text-xs text-gray-500">IP kamera sistemleri ve VIGI video yönetim yazılımı yetkinliği.</p>
                    </div>
                    <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#36373d] space-y-2">
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded uppercase border border-amber-500/20">Deco Mesh Master</span>
                      <h4 className="text-white font-bold text-sm">Geçme Notu: 65</h4>
                      <p className="text-xs text-gray-500">Ev tipi mesh Wi-Fi sistemleri ve optimizasyonu uzmanlığı.</p>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-[#2b2d31]/40 border border-[#36373d] rounded-lg text-xs text-gray-400 flex items-start gap-3">
                    <Info className="w-4 h-4 text-[#5865f2] flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Sınavların geçme limitlerini değiştirmek veya yeni sınavlar tanımlamak için <strong>Katılımcı Listesinden</strong> ilgili kişiyi seçip detay panelindeki <strong>"Yeni Sınav / Müfredat Tanımla"</strong> sihirbazını kullanabilirsiniz.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "upload" && (
                <div className="space-y-6">
                  
                  {/* Excel Upload Area matching the high-fidelity template */}
                  <div className="bg-[#313338] rounded-lg p-6 border border-[#36373d]/40 anti-gravity">
                    <h3 className="text-white font-bold text-base mb-1">Toplu Veri İçe Aktarma (Excel Sihirbazı)</h3>
                    <p className="text-xs text-gray-500 mb-6">TP-Link Akademi sınav sonuç listesini doğrudan yükleyerek kullanıcıları, katılımları ve sınav durumlarını saniyeler içinde güncelleyin.</p>

                    {/* Drag & Drop zone */}
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4 transition-all duration-300 cursor-pointer group bg-[#232428]/30 ${
                        dragActive ? 'border-[#5865f2] bg-[#5865f2]/5' : 'border-[#36373d] hover:border-[#5865f2]/50'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls"
                        className="hidden" 
                      />
                      <div className="w-16 h-16 rounded-full bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold text-base">Eğitim Sonuç Excelini Sürükleyip Bırakın</h4>
                        <p className="text-xs text-gray-500 max-w-md">
                          Dosyada <strong className="text-white">Ad, Soyad, Kurum, E-posta, Eğitim Adı, Sınav Adı, Sınav Puanı</strong> ve opsiyonel <strong className="text-white">Geçme Notu</strong> sütunları bulunmalıdır.
                        </p>
                      </div>
                      <button 
                        type="button"
                        className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-lg shadow-[#5865f2]/20 transition-all"
                      >
                        Bilgisayardan Dosya Seçin
                      </button>
                    </div>

                    {/* Upload progress & messages */}
                    {uploadProgress !== null && (
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-xs text-gray-400 font-bold">
                          <span>Dosya işleniyor...</span>
                          <span>%{uploadProgress}</span>
                        </div>
                        <div className="w-full bg-[#1e1f22] h-2 rounded-full overflow-hidden">
                          <div className="bg-[#5865f2] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      </div>
                    )}

                    {uploadStatusMsg && (
                      <div className="mt-4 p-3 bg-[#2b2d31] border border-[#36373d] rounded-lg text-xs text-[#b5bac1] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#5865f2]" />
                        <span>{uploadStatusMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* Preview Table of Excel Rows */}
                  {parsedRows.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#313338] rounded-lg p-5 border border-[#36373d]/40 anti-gravity space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-white font-bold text-sm">Önizleme ({parsedRows.length} Satır Çözümlendi)</h4>
                          <p className="text-xs text-gray-500">Veritabanına kaydetmeden önce aşağıdaki veriyi doğrulayın.</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setParsedRows([])}
                            className="bg-[#36373d] hover:bg-red-500/20 hover:text-red-400 px-4 py-2 rounded-md text-xs font-bold text-[#b5bac1] transition-all"
                          >
                            İptal Et
                          </button>
                          <button 
                            onClick={saveImportedData}
                            className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white px-5 py-2 rounded-md text-xs font-bold transition-all"
                          >
                            Veritabanına Yazdır
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left border-collapse text-xs text-gray-300">
                          <thead className="bg-[#1e1f22] font-bold text-gray-500 sticky top-0">
                            <tr>
                              <th className="px-4 py-2.5">Ad Soyad</th>
                              <th className="px-4 py-2.5">E-posta</th>
                              <th className="px-4 py-2.5">Kurum</th>
                              <th className="px-4 py-2.5">Eğitim Adı</th>
                              <th className="px-4 py-2.5">Sınav Adı</th>
                              <th className="px-4 py-2.5 text-right">Puan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e1f22]">
                            {parsedRows.map((row, i) => (
                              <tr key={i} className="hover:bg-[#36373d]/50">
                                <td className="px-4 py-2 text-white font-medium">
                                  {row["Ad"] || row["firstName"] || ""} {row["Soyad"] || row["lastName"] || ""}
                                </td>
                                <td className="px-4 py-2 font-mono">{row["E-posta"] || row["Email"] || row["email"] || "-"}</td>
                                <td className="px-4 py-2">{row["Kurum"] || row["Company"] || row["company"] || "-"}</td>
                                <td className="px-4 py-2">{row["Eğitim Adı"] || row["Egitim Adi"] || row["eventName"] || "-"}</td>
                                <td className="px-4 py-2 text-[#5865f2] font-medium">{row["Sınav Adı"] || row["Sinav Adi"] || row["examName"] || "-"}</td>
                                <td className="px-4 py-2 text-right font-bold text-white">{row["Sınav Puanı"] || row["score"] || "0"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </section>

        {/* 4. FLOATING PERSISTENT SYSTEM BOTTOM DOCK */}
        <div id="status-dock" className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 bg-[#313338] rounded-full anti-gravity flex items-center gap-8 border border-[#5865f2]/30 z-40 transition-transform hover:scale-102">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs font-bold text-white tracking-wide uppercase">SİSTEM AKTİF</span>
          </div>
          <div className="h-4 w-[1px] bg-[#2b2d31]"></div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span onClick={() => setActiveTab("participants")} className="text-gray-500 cursor-pointer hover:text-white px-2 py-1 rounded transition-colors">Loglar</span>
            <span className="text-gray-500">Versiyon 1.4.2</span>
            <span onClick={() => setActiveTab("upload")} className="text-[#5865f2] cursor-pointer px-2.5 py-1 rounded bg-[#5865f2]/10 hover:bg-[#5865f2]/20 transition-all font-semibold">
              Excel Sihirbazı
            </span>
          </div>
        </div>

        {/* 5. SLIDING SIDE DRAWER / PANEL FOR PARTICIPANTS DETAY PANELI */}
        <AnimatePresence>
          {selectedUser && (
            <>
              {/* Overlay Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedUser(null)}
                className="absolute inset-0 bg-black/60 z-40"
              />

              {/* Sliding Drawer Body matching the design spec perfectly */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 h-full w-96 bg-[#2b2d31] border-l border-[#1e1f22] z-50 shadow-2xl flex flex-col"
              >
                
                {/* Drawer Header */}
                <div className="p-6 border-b border-[#1e1f22] flex justify-between items-center bg-[#313338]/40">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#5865f2]" />
                    Detay Paneli
                  </h2>
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-500 hover:text-white hover:bg-[#36373d] p-1.5 rounded-md transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Drawer Scrollable Content */}
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                  
                  {/* User Avatar Summary */}
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-20 h-20 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-[#5865f2]/20 border-2 border-[#5865f2]/40">
                      {`${selectedUser.firstName?.[0] || ""}${selectedUser.lastName?.[0] || ""}`.toUpperCase()}
                    </div>
                    <div className="text-center">
                      <h3 className="text-white text-xl font-bold">{selectedUser.firstName} {selectedUser.lastName}</h3>
                      <p className="text-sm text-gray-500">{selectedUser.company || "Serbest Kurum"}</p>
                    </div>
                  </div>

                  {/* Communication block */}
                  <div className="bg-[#313338] p-4 rounded-lg border border-[#36373d] space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">İletişim Bilgileri</p>
                    <p className="text-sm text-white font-semibold font-mono">{selectedUser.phone || "+90 532 000 00 00"}</p>
                    <p className="text-xs text-gray-400 font-mono break-all">{selectedUser.email || "e-posta tanımsız"}</p>
                  </div>

                  {/* Exam history list */}
                  <div className="bg-[#313338] p-4 rounded-lg border border-[#36373d] space-y-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Eğitim & Sınav Geçmişi</p>
                    
                    {selectedUser.examResults?.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2">
                        Henüz sınav sonucu tanımlanmamış.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {selectedUser.examResults.map((result) => (
                          <div key={result.id} className="flex flex-col gap-1 pb-2 border-b border-[#1e1f22]/50 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-white">{result.exam?.name || "Eğitim Sınavı"}</span>
                              
                              {/* Passed / Failed indicators */}
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                result.status === "Geçti" 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}>
                                {result.status}
                              </span>
                            </div>

                            {/* Inline Edit score section */}
                            <div className="flex justify-between items-center mt-1">
                              {editingScoreId === result.id ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <input 
                                    type="number" 
                                    value={editScoreValue}
                                    onChange={(e) => setEditScoreValue(parseInt(e.target.value) || 0)}
                                    className="bg-[#1e1f22] text-xs text-white px-2 py-1 rounded w-16 font-bold border border-[#5865f2] focus:outline-none"
                                  />
                                  <button 
                                    onClick={() => saveScoreChange(result.exam.id)}
                                    className="bg-[#5865f2] text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-[#5865f2]/90"
                                  >
                                    Kaydet
                                  </button>
                                  <button 
                                    onClick={() => setEditingScoreId(null)}
                                    className="text-gray-500 hover:text-white text-[10px] px-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[11px] text-gray-400">Puan: <strong className="text-white font-mono">{result.score}</strong></span>
                                  <button 
                                    onClick={() => {
                                      setEditingScoreId(result.id);
                                      setEditScoreValue(result.score);
                                    }}
                                    className="text-[10px] text-[#5865f2] hover:underline font-bold"
                                  >
                                    Notu Güncelle
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add exam inline wizard */}
                  <div className="space-y-3 pt-2">
                    {showAssignForm ? (
                      <div className="bg-[#313338] p-4 rounded-lg border border-[#5865f2]/30 space-y-3">
                        <h4 className="text-white text-xs font-bold">Yeni Sınav Atama Sihirbazı</h4>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Sınav Adı</label>
                          <input 
                            type="text" 
                            placeholder="Örn: Omada Expert V2" 
                            value={newExamName}
                            onChange={(e) => setNewExamName(e.target.value)}
                            className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Geçme Notu</label>
                          <input 
                            type="number" 
                            value={newExamPassingScore}
                            onChange={(e) => setNewExamPassingScore(parseInt(e.target.value) || 70)}
                            className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button 
                            onClick={() => {
                              const activeEventId = selectedUser.attendances?.[0]?.event?.id || events[0]?.id;
                              if (activeEventId) {
                                handleAssignExam(activeEventId);
                              } else {
                                alert("Önce en az bir etkinlik bulunmalıdır.");
                              }
                            }}
                            className="bg-[#5865f2] text-white font-bold text-xs px-3 py-1.5 rounded flex-1"
                          >
                            Müfredata Ekle
                          </button>
                          <button 
                            onClick={() => setShowAssignForm(false)}
                            className="bg-[#36373d] text-gray-400 font-bold text-xs px-3 py-1.5 rounded"
                          >
                            Kapat
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowAssignForm(true)}
                        className="w-full bg-[#5865f2] text-white py-3 rounded-lg font-bold hover:bg-[#5865f2]/90 transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#5865f2]/10"
                      >
                        <Plus className="w-4 h-4" /> Yeni Sınav / Müfredat Tanımla
                      </button>
                    )}
                  </div>

                </div>

              </motion.div>
            </>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
