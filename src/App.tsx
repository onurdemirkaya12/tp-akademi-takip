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
  Info,
  Trash2,
  Sliders,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { read, utils } from "xlsx";
import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, writeBatch, arrayUnion, deleteDoc } from "firebase/firestore";

type TabType = "dashboard" | "participants" | "events" | "exams" | "upload" | "settings";

interface DropdownSettings {
  eventTypes: string[];
  trainers: string[];
  purposes: string[];
  contents: string[];
}

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
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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

  // Event Form Modal State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    eventType: "",
    date: "",
    trainer: "",
    purpose: "",
    content: "",
    description: ""
  });

  // Settings State
  const [dropdownSettings, setDropdownSettings] = useState<DropdownSettings>({
    eventTypes: ["Seminer", "Webinar", "Workshop"],
    trainers: ["Eğitmen 1", "Eğitmen 2"],
    purposes: ["Sertifikasyon", "Bilgilendirme"],
    contents: ["Network Temelleri", "İleri Düzey Yönlendirme"]
  });
  const [settingsInputs, setSettingsInputs] = useState({
    eventTypes: "", trainers: "", purposes: "", contents: ""
  });

  // Fetch data from Firebase Firestore
  const fetchData = async () => {
    try {
      setLoading(true);
      const usersCol = collection(db, "users");
      const eventsCol = collection(db, "events");
      const settingsDoc = doc(db, "settings", "dropdowns");
      
      const [usersSnapshot, eventsSnapshot, settingsSnapshot] = await Promise.all([
        getDocs(usersCol),
        getDocs(eventsCol),
        getDoc(settingsDoc)
      ]);
      
      const usersData = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as UserData[];
      const eventsData = eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as EventData[];
      
      if (settingsSnapshot.exists()) {
        setDropdownSettings(settingsSnapshot.data() as DropdownSettings);
      }
      
      setUsers(usersData);
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleUpdateDropdowns = async (newSettings: DropdownSettings) => {
    setDropdownSettings(newSettings);
    try {
      await setDoc(doc(db, "settings", "dropdowns"), newSettings, { merge: true });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleAddDropdownItem = (category: keyof DropdownSettings) => {
    const value = settingsInputs[category].trim();
    if (!value) return;
    const newSettings = { ...dropdownSettings, [category]: [...dropdownSettings[category], value] };
    handleUpdateDropdowns(newSettings);
    setSettingsInputs({ ...settingsInputs, [category]: "" });
  };

  const handleRemoveDropdownItem = (category: keyof DropdownSettings, index: number) => {
    const newSettings = { 
      ...dropdownSettings, 
      [category]: dropdownSettings[category].filter((_, i) => i !== index) 
    };
    handleUpdateDropdowns(newSettings);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Deletion functions
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Bu katılımcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(u => u.id !== userId));
      if (selectedUser?.id === userId) setSelectedUser(null);
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } catch (error) {
      console.error("Kullanıcı silinirken hata:", error);
      alert("Silme işlemi başarısız oldu.");
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Seçilen ${selectedUserIds.length} katılımcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      selectedUserIds.forEach(id => {
        batch.delete(doc(db, "users", id));
      });
      await batch.commit();
      setUsers(users.filter(u => !selectedUserIds.includes(u.id)));
      setSelectedUserIds([]);
      if (selectedUser && selectedUserIds.includes(selectedUser.id)) setSelectedUser(null);
    } catch (error) {
      console.error("Toplu silme hatası:", error);
      alert("Toplu silme işlemi başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "events", eventId));
      setEvents(events.filter(e => e.id !== eventId));
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
    } catch (error) {
      console.error("Etkinlik silinirken hata:", error);
      alert("Silme işlemi başarısız oldu.");
    }
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
        
        const rowsAsArrays = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let headerRowIndex = -1;
        
        for (let i = 0; i < Math.min(10, rowsAsArrays.length); i++) {
          const row = rowsAsArrays[i];
          if (!row) continue;
          
          const stringContent = row.filter(Boolean).map(String).join(" ");
          const lowerStr = stringContent.toLowerCase();
          if (lowerStr.includes("ad") && lowerStr.includes("soyad") && lowerStr.includes("posta")) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error("Geçerli bir başlık satırı (Ad, Soyad, E-Posta vb.) bulunamadı.");
        }
        
        const headers = rowsAsArrays[headerRowIndex] || [];
        const json = [];
        
        for (let i = headerRowIndex + 1; i < rowsAsArrays.length; i++) {
          const rowData = rowsAsArrays[i];
          if (!rowData || rowData.length === 0) continue;
          
          let rowObj: any = {};
          headers.forEach((h: string, index: number) => {
            if (h) rowObj[h] = rowData[index];
          });
          
          if (Object.keys(rowObj).length > 0) {
            json.push(rowObj);
          }
        }
        
        setUploadProgress(90);
        setParsedRows(json);
        setUploadProgress(100);
        setUploadStatusMsg(`${file.name} başarıyla çözümlendi!`);
        
        setTimeout(() => {
          setUploadProgress(null);
        }, 1500);
      } catch (err: any) {
        console.error("Error reading file:", err);
        setUploadProgress(null);
        setUploadStatusMsg(`Hata: ${err.message || "Excel dosyası okunamadı. Lütfen geçerli bir dosya yükleyin."}`);
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // Save imported rows to database (Firebase)
  const saveImportedData = async () => {
    if (parsedRows.length === 0) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const generatedEventName = eventFormData.content || eventFormData.eventType || "Genel Eğitim";
      const eventId = generatedEventName.replace(/[^a-zA-Z0-9]/g, "") + "-" + Date.now();
      
      let processed = 0;
      for (const row of parsedRows) {
        const firstName = row["Ad"] || row["firstName"] || "";
        const lastName = row["Soyad"] || row["lastName"] || "";
        const email = row["E-Posta"] || row["E-posta"] || row["Email"] || row["email"] || "";
        const company = row["Firma"] || row["Kurum"] || row["Company"] || row["company"] || "";
        const phone = row["Telefon"] || row["Phone"] || row["phone"] || "";
        
        if (!firstName || !lastName) continue;
        
        const userId = email ? email.replace(/[^a-zA-Z0-9]/g, "") : `${firstName}${lastName}`.replace(/[^a-zA-Z0-9]/g, "");
        
        const userRef = doc(db, "users", userId);
        batch.set(userRef, {
          firstName, lastName, email, company, phone,
          attendances: arrayUnion({
            id: `${userId}-${eventId}`,
            event: { id: eventId, name: generatedEventName, date: eventFormData.date || new Date().toISOString() }
          })
        }, { merge: true });

        const eventRef = doc(db, "events", eventId);
        batch.set(eventRef, {
          name: generatedEventName,
          date: eventFormData.date || new Date().toISOString(),
          eventType: eventFormData.eventType,
          trainer: eventFormData.trainer,
          purpose: eventFormData.purpose,
          content: eventFormData.content,
          description: eventFormData.description,
          attendances: arrayUnion({
            id: `${userId}-${eventId}`,
            user: { id: userId, firstName, lastName, company }
          })
        }, { merge: true });
        
        processed++;
      }
      
      await batch.commit();
      
      setUploadStatusMsg(`Başarılı! ${processed} katılımcı "${generatedEventName}" etkinliğine eklendi.`);
      setParsedRows([]);
      setIsEventModalOpen(false);
      fetchData();
      setActiveTab("participants");
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
      const userRef = doc(db, "users", selectedUser.id);
      
      const updatedResults = selectedUser.examResults.map(r => {
        if (r.exam.id === examId) {
          const status = editScoreValue >= r.exam.passingScore ? "Geçti" : "Kaldı";
          return { ...r, score: editScoreValue, status };
        }
        return r;
      });
      
      await setDoc(userRef, { examResults: updatedResults }, { merge: true });
      
      await fetchData();
      setEditingScoreId(null);
      setSelectedUser(prev => prev ? { ...prev, examResults: updatedResults } : null);
      
    } catch (error) {
      console.error("Failed to update score:", error);
    }
  };

  // Add/Assign new exam to event of the user
  const handleAssignExam = async (eventId: string) => {
    if (!selectedUser || !newExamName) return;
    try {
      const userRef = doc(db, "users", selectedUser.id);
      const examId = newExamName.replace(/[^a-zA-Z0-9]/g, "");
      
      const newExamResult = {
        id: `${selectedUser.id}-${examId}`,
        score: 0,
        status: "Kaldı",
        exam: {
          id: examId,
          name: newExamName,
          passingScore: newExamPassingScore,
          event: { id: eventId, name: "Event" }
        }
      };
      
      const updatedResults = [...(selectedUser.examResults || []), newExamResult];
      await setDoc(userRef, { examResults: updatedResults }, { merge: true });
      
      await fetchData();
      
      setShowAssignForm(false);
      setNewExamName("");
      setSelectedUser(prev => prev ? { ...prev, examResults: updatedResults } : null);
      
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
            onClick={() => { setActiveTab("dashboard"); setSelectedEvent(null); setSelectedUser(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              activeTab === "dashboard" 
                ? "active-nav font-semibold" 
                : "text-[#b5bac1] discord-hover"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
            <span>Ana Sayfa</span>
          </button>

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
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-lg text-sm font-medium transition-all duration-200 group ${
                activeTab === "settings" 
                  ? "active-nav font-semibold" 
                  : "text-[#b5bac1] discord-hover"
              }`}
            >
              <Sliders className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
              <span>Seçenek Yönetimi</span>
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
              {activeTab === "dashboard" && "Ana Sayfa / İstatistikler"}
              {activeTab === "participants" && "Katılımcı Yönetimi"}
              {activeTab === "events" && "Etkinlik Planlama"}
              {activeTab === "exams" && "Sertifika & Sınavlar"}
              {activeTab === "upload" && "Akıllı Excel Sihirbazı"}
              {activeTab === "settings" && "Seçenek Yönetimi"}
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-[#b5bac1] font-normal text-sm flex items-center gap-1.5">
              {activeTab === "dashboard" && "Genel Bakış"}
              {activeTab === "participants" && `${users.length} Toplam Kayıt`}
              {activeTab === "events" && `${events.length} Aktif Eğitim`}
              {activeTab === "exams" && "Puan Baremleri"}
              {activeTab === "upload" && "Sürükle-bırak excel aktarımı"}
              {activeTab === "settings" && "Dinamik Form Seçenekleri"}
              
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
              
              {/* TAB-SPECIFIC STATISTICS CARDS */}
              {activeTab === "participants" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Katılım</span>
                    <span className="text-3xl font-bold text-white">{users.reduce((acc, u) => acc + (u.attendances?.length || 0), 0)}</span>
                    <span className="text-xs text-[#b5bac1] mt-1">Eğitimlere yapılan toplam kayıt</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Uniq Katılımcı</span>
                    <span className="text-3xl font-bold text-white">{users.length}</span>
                    <span className="text-xs text-[#b5bac1] mt-1">Sisteme kayıtlı tekil kullanıcı</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Katılım / Tekil Oranı</span>
                    <span className="text-3xl font-bold text-white">
                      {users.length > 0 ? (users.reduce((acc, u) => acc + (u.attendances?.length || 0), 0) / users.length).toFixed(1) : "0"}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Kişi başı ortalama eğitim sayısı</span>
                  </div>
                </div>
              )}

              {activeTab === "events" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Etkinlik</span>
                    <span className="text-3xl font-bold text-white">{events.length}</span>
                    <span className="text-xs text-[#b5bac1] mt-1">Tüm zamanların kayıtlı etkinlikleri</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aktif Etkinlikler</span>
                    <span className="text-3xl font-bold text-white">
                      {events.filter(e => new Date(e.date) >= new Date()).length}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Tarihi geçmemiş planlanan etkinlikler</span>
                  </div>
                </div>
              )}

              {activeTab === "exams" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Sınav Kaydı</span>
                    <span className="text-3xl font-bold text-white">{users.reduce((acc, u) => acc + (u.examResults?.length || 0), 0)}</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Başarılı Olanlar</span>
                    <span className="text-3xl font-bold text-white">{users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0)}</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Başarı Oranı</span>
                    <span className="text-3xl font-bold text-white">
                      {(() => {
                        const total = users.reduce((acc, u) => acc + (u.examResults?.length || 0), 0);
                        const passed = users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0);
                        return total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
                      })()}%
                    </span>
                  </div>
                </div>
              )}

              {/* TAB CONTENTS */}
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  {/* TOP FLIGHT STATISTICS CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#5865f2]/5 rounded-full blur-xl group-hover:bg-[#5865f2]/10 transition-colors duration-300"></div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aktif Katılımcılar</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{users.length}</span>
                        <span className="text-[10px] text-green-400 font-semibold bg-green-500/10 px-1.5 py-0.5 rounded">+%12 geçen aydan beri</span>
                      </div>
                      <span className="text-xs text-[#b5bac1] mt-1">Sisteme kayıtlı tekil öğrenci sayısı</span>
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
                      <span className="text-xs text-[#b5bac1] mt-1">Akademi sınavlarına giren kişi sayısı</span>
                    </div>

                    <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Genel Başarı Oranı</span>
                      <span className="text-3xl font-bold text-white">
                        {(() => {
                          const total = users.reduce((acc, u) => acc + (u.examResults?.length || 0), 0);
                          const passed = users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0);
                          return total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
                        })()}%
                      </span>
                      <div className="w-full bg-[#1e1f22] h-2 mt-2 rounded-full overflow-hidden">
                        <div className="bg-[#5865f2] h-full rounded-full transition-all duration-1000" style={{ width: (() => {
                          const total = users.reduce((acc, u) => acc + (u.examResults?.length || 0), 0);
                          const passed = users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0);
                          return total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
                        })() + "%" }}></div>
                      </div>
                    </div>
                  </div>

                  {/* CHARTS ROW */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#313338] p-6 rounded-lg border border-[#36373d]/50 shadow-md">
                      <h3 className="text-white font-bold text-base mb-6 flex items-center gap-2">
                        <BarChart className="w-5 h-5 text-[#5865f2]" /> Son Etkinlik Katılımları
                      </h3>
                      <div className="h-64 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={events.slice(0, 5).map(e => ({ name: e.name.substring(0, 15) + (e.name.length > 15 ? '...' : ''), katilim: e.attendances?.length || 0 }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#36373d" vertical={false} />
                            <XAxis dataKey="name" stroke="#80848e" tick={{fill: '#80848e'}} tickLine={false} axisLine={false} />
                            <YAxis stroke="#80848e" tick={{fill: '#80848e'}} tickLine={false} axisLine={false} />
                            <RechartsTooltip cursor={{fill: '#2b2d31'}} contentStyle={{backgroundColor: '#1e1f22', border: '1px solid #36373d', borderRadius: '8px', color: '#fff'}} />
                            <Bar dataKey="katilim" fill="#5865f2" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-[#313338] p-6 rounded-lg border border-[#36373d]/50 shadow-md">
                      <h3 className="text-white font-bold text-base mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-[#5865f2]" /> Sınav Başarı Dağılımı
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Başarılı', value: users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0) },
                                { name: 'Başarısız', value: users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Kaldı").length || 0), 0) }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell key="cell-0" fill="#5865f2" />
                              <Cell key="cell-1" fill="#ed4245" />
                            </Pie>
                            <RechartsTooltip contentStyle={{backgroundColor: '#1e1f22', border: '1px solid #36373d', borderRadius: '8px', color: '#fff'}} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-6 mt-2">
                          <div className="flex items-center gap-2 text-xs text-[#b5bac1]">
                            <div className="w-3 h-3 rounded-full bg-[#5865f2]"></div> Başarılı
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#b5bac1]">
                            <div className="w-3 h-3 rounded-full bg-[#ed4245]"></div> Başarısız
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "participants" && (
                <div className="bg-[#313338] rounded-lg flex flex-col anti-gravity overflow-hidden border border-[#36373d]/40">
                  <div className="p-5 border-b border-[#1e1f22] bg-[#2b2d31]/30 flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-bold text-base">Güncel Katılımcı Listesi</h3>
                      <p className="text-xs text-gray-500">Katılımcıların detaylarını, katıldıkları eğitimleri ve sınav notlarını görmek için satıra tıklayın.</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {selectedUserIds.length > 0 && (
                        <button 
                          onClick={handleBulkDeleteUsers}
                          className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded border border-red-500/20 font-bold text-xs transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Seçili {selectedUserIds.length} Kişiyi Sil
                        </button>
                      )}
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
                            <th className="px-6 py-4 w-10">
                              <input 
                                type="checkbox" 
                                className="rounded border-[#36373d] bg-[#1e1f22] text-[#5865f2] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedUserIds(filteredUsers.map(u => u.id));
                                  else setSelectedUserIds([]);
                                }}
                              />
                            </th>
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
                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-[#36373d] bg-[#1e1f22] text-[#5865f2] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    checked={selectedUserIds.includes(user.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedUserIds([...selectedUserIds, user.id]);
                                      else setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                    }}
                                  />
                                </td>
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
                                  <div className="flex items-center justify-end gap-3">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }}
                                      className="text-gray-500 hover:text-red-400 font-semibold text-xs transition-colors flex items-center p-1 rounded hover:bg-red-500/10"
                                      title="Kullanıcıyı Sil"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button className="text-gray-500 hover:text-white font-semibold text-xs group-hover:text-white group-hover:translate-x-[-2px] transition-all flex items-center gap-1">
                                      Detay <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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
                              <h4 className="text-white font-bold text-base group-hover:text-[#5865f2] transition-colors pr-2">{event.name}</h4>
                              <div className="flex items-center gap-2 shrink-0">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                  className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                                  title="Etkinliği Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] bg-[#5865f2]/10 text-[#5865f2] font-bold px-2 py-0.5 rounded border border-[#5865f2]/20">
                                  ETKİNLİK
                                </span>
                              </div>
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
                        <h4 className="text-white font-bold text-base">Eğitim Katılımcı Excelini Sürükleyip Bırakın</h4>
                        <p className="text-xs text-gray-500 max-w-md">
                          Dosyada <strong className="text-white">Ad, Soyad, E-Posta, Telefon, Firma</strong> sütunları bulunmalıdır. Etkinlik adı ilk satırdan otomatik algılanır.
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
                            onClick={() => setIsEventModalOpen(true)}
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
                              <th className="px-4 py-2.5">Telefon</th>
                              <th className="px-4 py-2.5">Firma</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e1f22]">
                            {parsedRows.map((row, i) => (
                              <tr key={i} className="hover:bg-[#36373d]/50">
                                <td className="px-4 py-2 text-white font-medium">
                                  {row["Ad"] || row["firstName"] || ""} {row["Soyad"] || row["lastName"] || ""}
                                </td>
                                <td className="px-4 py-2 font-mono">{row["E-Posta"] || row["E-posta"] || row["Email"] || row["email"] || "-"}</td>
                                <td className="px-4 py-2 font-mono">{row["Telefon"] || row["Phone"] || row["phone"] || "-"}</td>
                                <td className="px-4 py-2">{row["Firma"] || row["Kurum"] || row["Company"] || row["company"] || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}


                </div>
              )}

                  {/* Yeni Sekme: Seçenek Yönetimi */}
                  {activeTab === "settings" && (
                    <div className="space-y-6">
                      <div className="bg-[#313338] p-6 rounded-lg border border-[#36373d]/50 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                          <Sliders className="w-5 h-5 text-[#5865f2]" />
                          <h3 className="text-white font-bold text-lg">Seçenek Yönetimi</h3>
                        </div>
                        <p className="text-xs text-[#b5bac1] mb-6">
                          Buradan yeni etkinlik tanımlama ekranındaki açılır liste (dropdown) seçeneklerini dinamik olarak düzenleyebilirsiniz.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Etkinlik Türü */}
                          <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22]">
                            <h4 className="text-sm font-bold text-gray-300 mb-4">Etkinlik Türü</h4>
                            <div className="flex gap-2 mb-4">
                              <input 
                                type="text"
                                value={settingsInputs.eventTypes}
                                onChange={e => setSettingsInputs({...settingsInputs, eventTypes: e.target.value})}
                                placeholder="Örn: Saha Eğitimi"
                                className="flex-1 bg-[#1e1f22] border border-[#36373d] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDropdownItem("eventTypes"); }}
                              />
                              <button 
                                onClick={() => handleAddDropdownItem("eventTypes")}
                                className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center"
                              >
                                Ekle
                              </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dropdownSettings.eventTypes.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#1e1f22] p-2.5 rounded border border-[#36373d]">
                                  <span className="text-xs text-white">{item}</span>
                                  <button onClick={() => handleRemoveDropdownItem("eventTypes", idx)} className="text-red-400 hover:text-red-300">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Eğitmen */}
                          <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22]">
                            <h4 className="text-sm font-bold text-gray-300 mb-4">Eğitmen</h4>
                            <div className="flex gap-2 mb-4">
                              <input 
                                type="text"
                                value={settingsInputs.trainers}
                                onChange={e => setSettingsInputs({...settingsInputs, trainers: e.target.value})}
                                placeholder="Örn: Ahmet Yılmaz"
                                className="flex-1 bg-[#1e1f22] border border-[#36373d] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDropdownItem("trainers"); }}
                              />
                              <button 
                                onClick={() => handleAddDropdownItem("trainers")}
                                className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center"
                              >
                                Ekle
                              </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dropdownSettings.trainers.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#1e1f22] p-2.5 rounded border border-[#36373d]">
                                  <span className="text-xs text-white">{item}</span>
                                  <button onClick={() => handleRemoveDropdownItem("trainers", idx)} className="text-red-400 hover:text-red-300">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Eğitim Amacı */}
                          <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22]">
                            <h4 className="text-sm font-bold text-gray-300 mb-4">Eğitim Amacı</h4>
                            <div className="flex gap-2 mb-4">
                              <input 
                                type="text"
                                value={settingsInputs.purposes}
                                onChange={e => setSettingsInputs({...settingsInputs, purposes: e.target.value})}
                                placeholder="Örn: Yeni Ürün Lansmanı"
                                className="flex-1 bg-[#1e1f22] border border-[#36373d] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDropdownItem("purposes"); }}
                              />
                              <button 
                                onClick={() => handleAddDropdownItem("purposes")}
                                className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center"
                              >
                                Ekle
                              </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dropdownSettings.purposes.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#1e1f22] p-2.5 rounded border border-[#36373d]">
                                  <span className="text-xs text-white">{item}</span>
                                  <button onClick={() => handleRemoveDropdownItem("purposes", idx)} className="text-red-400 hover:text-red-300">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Eğitim İçeriği */}
                          <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#1e1f22]">
                            <h4 className="text-sm font-bold text-gray-300 mb-4">Eğitim İçeriği</h4>
                            <div className="flex gap-2 mb-4">
                              <input 
                                type="text"
                                value={settingsInputs.contents}
                                onChange={e => setSettingsInputs({...settingsInputs, contents: e.target.value})}
                                placeholder="Örn: Omada Switch Konfigürasyonu"
                                className="flex-1 bg-[#1e1f22] border border-[#36373d] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865f2]"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDropdownItem("contents"); }}
                              />
                              <button 
                                onClick={() => handleAddDropdownItem("contents")}
                                className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center"
                              >
                                Ekle
                              </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dropdownSettings.contents.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#1e1f22] p-2.5 rounded border border-[#36373d]">
                                  <span className="text-xs text-white">{item}</span>
                                  <button onClick={() => handleRemoveDropdownItem("contents", idx)} className="text-red-400 hover:text-red-300">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
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

      {/* EVENT MODAL */}
      <AnimatePresence>
        {isEventModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setIsEventModalOpen(false)}
              className="absolute inset-0 bg-black/60 z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-[#313338] border border-[#1e1f22] rounded-xl shadow-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-[#1e1f22] flex justify-between items-center bg-[#2b2d31]/50">
                <h2 className="text-white font-bold text-lg">Yeni Ekle</h2>
                <button onClick={() => setIsEventModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Etkinlik Türü <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={eventFormData.eventType} onChange={e => setEventFormData({...eventFormData, eventType: e.target.value})}
                        className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                      >
                        <option value="">Lütfen Seçiniz</option>
                        {dropdownSettings.eventTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                      </select>
                      <button className="bg-[#2b2d31] border border-[#1e1f22] rounded-md p-2 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Eğitmen <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={eventFormData.trainer} onChange={e => setEventFormData({...eventFormData, trainer: e.target.value})}
                        className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                      >
                        <option value="">Lütfen Seçiniz</option>
                        {dropdownSettings.trainers.map((t, i) => <option key={i} value={t}>{t}</option>)}
                      </select>
                      <button className="bg-[#2b2d31] border border-[#1e1f22] rounded-md p-2 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Tarih <span className="text-red-400">*</span></label>
                    <input 
                      type="datetime-local" 
                      value={eventFormData.date} onChange={e => setEventFormData({...eventFormData, date: e.target.value})}
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Eğitim Amacı <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={eventFormData.purpose} onChange={e => setEventFormData({...eventFormData, purpose: e.target.value})}
                        className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                      >
                        <option value="">Lütfen Seçiniz</option>
                        {dropdownSettings.purposes.map((p, i) => <option key={i} value={p}>{p}</option>)}
                      </select>
                      <button className="bg-[#2b2d31] border border-[#1e1f22] rounded-md p-2 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Eğitim İçeriği <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <select 
                        value={eventFormData.content} onChange={e => setEventFormData({...eventFormData, content: e.target.value})}
                        className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                      >
                        <option value="">Lütfen Seçiniz</option>
                        {dropdownSettings.contents.map((c, i) => <option key={i} value={c}>{c}</option>)}
                      </select>
                      <button className="bg-[#2b2d31] border border-[#1e1f22] rounded-md p-2 text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-gray-400">Açıklama</label>
                  <textarea 
                    value={eventFormData.description} onChange={e => setEventFormData({...eventFormData, description: e.target.value})}
                    rows={4}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-[#1e1f22] bg-[#2b2d31]/50 flex justify-end gap-3">
                <button onClick={() => setIsEventModalOpen(false)} className="px-5 py-2 rounded-md bg-[#36373d] text-white text-sm font-semibold hover:bg-[#36373d]/80 transition-colors">
                  İptal
                </button>
                <button onClick={saveImportedData} disabled={loading} className="px-5 py-2 rounded-md bg-[#5865f2] text-white text-sm font-semibold hover:bg-[#5865f2]/90 transition-colors flex items-center gap-2">
                  <Database className="w-4 h-4" /> Oluştur
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
