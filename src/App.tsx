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
  ChevronUp,
  ArrowUpDown,
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
  LayoutDashboard,
  Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { read, utils, writeFile } from "xlsx";
import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, writeBatch, arrayUnion, deleteDoc } from "firebase/firestore";

type TabType = "dashboard" | "invitees" | "participants" | "events" | "exams" | "upload" | "settings";

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
  examStatus?: string;
  attendances: {
    id: string;
    attendanceStatus?: string; // "Katıldı" | "Katılmadı" | "Bekliyor"
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
  endDate?: string;
  timeRange?: string;
  location?: string;
  link?: string;
  exams: {
    id: string;
    name: string;
    passingScore: number;
  }[];
  attendances: {
    id: string;
    attendanceStatus?: string; // "Katıldı" | "Katılmadı" | "Bekliyor"
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

  // Invitees tab specific state
  const [inviteeSearchTerm, setInviteeSearchTerm] = useState("");
  const [inviteeEventFilter, setInviteeEventFilter] = useState("all");
  const [inviteeStatusFilter, setInviteeStatusFilter] = useState("all");
  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Detail panel state
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [editingEventData, setEditingEventData] = useState<Partial<EventData> | null>(null);
  const [quickAddParticipant, setQuickAddParticipant] = useState({ firstName: "", lastName: "", email: "", phone: "" });

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
  const [uploadType, setUploadType] = useState<"event" | "invitee" | "exam">("invitee");
  const [targetEventForUpload, setTargetEventForUpload] = useState<EventData | null>(null);
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

  const [examUploadData, setExamUploadData] = useState({
    examName: "",
    passingScore: 60
  });

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{message: string, type: "error" | "success"} | null>(null);

  // Show Toast Helper
  const showToast = (message: string, type: "error" | "success" = "error") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 5000); // Hide after 5 seconds
  };

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    startDate: "",
    endDate: "",
    eventName: "Tümü",
    examStatus: "Tümü",
    companyName: "Tümü"
  });

  // Certificate Export Modal State
  const [isCertificateExportModalOpen, setIsCertificateExportModalOpen] = useState(false);
  const [certificateExportFilters, setCertificateExportFilters] = useState({
    examType: "Tümü",
    companyName: "Tümü",
    examStatus: "Tümü",
    dateRange: ""
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

  const handleDeleteInvitee = async (userId: string, eventId: string) => {
    if (!window.confirm("Bu davetli kaydını silmek istediğinize emin misiniz?")) return;
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      const newAttendances = (user.attendances || []).filter(a => a.event.id !== eventId);
      
      await setDoc(doc(db, "users", userId), { attendances: newAttendances }, { merge: true });
      
      setUsers(users.map(u => u.id === userId ? { ...u, attendances: newAttendances } : u));
      setSelectedInviteeIds(selectedInviteeIds.filter(id => id !== `${userId}-${eventId}`));
    } catch (error) {
      console.error("Davetli silinirken hata:", error);
      alert("Silme işlemi başarısız oldu.");
    }
  };

  const handleBulkDeleteInvitees = async () => {
    if (selectedInviteeIds.length === 0) return;
    if (!window.confirm(`Seçilen ${selectedInviteeIds.length} davetli kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);
      const userUpdates = new Map<string, any[]>();
      
      selectedInviteeIds.forEach(idPair => {
        const userId = idPair.split("-")[0];
        const actualEventId = idPair.substring(userId.length + 1);
        
        if (!userUpdates.has(userId)) {
          const user = users.find(u => u.id === userId);
          userUpdates.set(userId, user?.attendances || []);
        }
        
        const currentAttendances = userUpdates.get(userId) || [];
        userUpdates.set(userId, currentAttendances.filter(a => a.event.id !== actualEventId));
      });
      
      userUpdates.forEach((newAttendances, userId) => {
        batch.set(doc(db, "users", userId), { attendances: newAttendances }, { merge: true });
      });
      
      await batch.commit();
      
      setUsers(users.map(u => {
        if (userUpdates.has(u.id)) {
          return { ...u, attendances: userUpdates.get(u.id)! };
        }
        return u;
      }));
      setSelectedInviteeIds([]);
    } catch (error) {
      console.error("Toplu davetli silme hatası:", error);
      alert("Toplu silme işlemi başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = React.useMemo(() => {
    let sortableUsers = users.filter(u => {
      // 1. En az bir "Katıldı" durumu olanlar (veya eski format olan durum belirtilmeyenler)
      const hasActualAttendance = u.attendances?.some(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus);
      
      // 2. Sınav sonucu olanlar
      const hasExamResults = u.examResults && u.examResults.length > 0;
      
      return hasActualAttendance || hasExamResults;
    });
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        let aValue = "";
        let bValue = "";
        if (sortConfig.key === "name") {
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
        } else if (sortConfig.key === "email") {
          aValue = (a.email || "").toLowerCase();
          bValue = (b.email || "").toLowerCase();
        } else if (sortConfig.key === "company") {
          aValue = (a.company || "").toLowerCase();
          bValue = (b.company || "").toLowerCase();
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  // Search filtering
  const filteredUsers = sortedUsers.filter(user => 
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.company && user.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.location && event.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Invitees data derived from users attendances
  const inviteesData = React.useMemo(() => {
    let result = users.flatMap(user => {
      if (!user.attendances || user.attendances.length === 0) return [];
      return user.attendances.map(att => ({
        user: user,
        attendance: att
      }));
    });

    if (inviteeSearchTerm) {
      const lowerSearch = inviteeSearchTerm.toLowerCase();
      result = result.filter(item => 
        `${item.user.firstName} ${item.user.lastName}`.toLowerCase().includes(lowerSearch) ||
        (item.user.email && item.user.email.toLowerCase().includes(lowerSearch)) ||
        (item.user.company && item.user.company.toLowerCase().includes(lowerSearch))
      );
    }

    if (inviteeEventFilter !== "all") {
      result = result.filter(item => item.attendance.event.id === inviteeEventFilter);
    }

    if (inviteeStatusFilter !== "all") {
      result = result.filter(item => item.attendance.attendanceStatus === inviteeStatusFilter);
    }

    return result;
  }, [users, inviteeSearchTerm, inviteeEventFilter, inviteeStatusFilter]);

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
    if (uploadType === "exam" && !examUploadData.examName.trim()) {
      showToast("Lütfen yükleme yapmadan önce yüklenecek 'Sınav Adı' alanını doldurun.", "error");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
        
        const rowsAsArrays = utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
        
        // Find the actual header row by looking for email columns
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rowsAsArrays.length); i++) {
          if (!rowsAsArrays[i]) continue;
          
          const rowString = rowsAsArrays[i].map(c => String(c).toLowerCase().trim()).join(" ");
          if (rowString.includes("email") || rowString.includes("e-posta") || rowString.includes("eposta") || rowString.includes("e-mail")) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          showToast("Yükleme İptal Edildi: Geçerli bir dosya bulunamadı veya dosya boş.", "error");
          setUploadProgress(null);
          return;
        }

        const rawHeaders = rowsAsArrays[headerRowIndex] || [];
        const headersLower = rawHeaders.map(h => String(h).toLowerCase().trim());
        
        // Define required mappings
        const getColumnIndex = (possibleNames: string[]) => {
          return headersLower.findIndex(h => possibleNames.includes(h));
        };

        const json = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (uploadType === "event" || uploadType === "invitee") {
          const idxAd = getColumnIndex(["adı", "ad", "firstname", "first name", "name", "isim", "adınız"]);
          const idxSoyad = getColumnIndex(["soyadı", "soyad", "lastname", "last name", "soyisim", "soyadınız"]);
          const idxEmail = getColumnIndex(["email", "e-posta", "eposta", "e-mail"]);
          const idxFirma = getColumnIndex(["firma bilgisi", "firma", "kurum", "company", "şirket", "sirket", "firma adı", "kurum adı", "organization", "bayi", "bayi adı"]);
          const idxTelefon = getColumnIndex(["telefon", "phone", "tel", "cep", "cep telefonu", "mobile"]);

          // Validate Header Structure
          if (idxAd === -1 || idxSoyad === -1 || idxEmail === -1) {
            showToast(`Yükleme İptal Edildi: Şablonda 'Adı', 'Soyadı' veya 'Email' sütunları eksik.`, "error");
            setUploadProgress(null);
            return;
          }

          // Validate each row
          for (let i = headerRowIndex + 1; i < rowsAsArrays.length; i++) {
            const rowData = rowsAsArrays[i];
            if (!rowData || !rowData.some(cell => String(cell).trim() !== "")) continue;
            
            const ad = String(rowData[idxAd] || "").trim();
            const soyad = String(rowData[idxSoyad] || "").trim();
            const email = String(rowData[idxEmail] || "").trim();
            const firma = idxFirma !== -1 ? String(rowData[idxFirma] || "").trim() : "";
            const telefon = idxTelefon !== -1 ? String(rowData[idxTelefon] || "").trim() : "";
            
            if (!ad) {
              showToast(`Yükleme İptal Edildi: Eğitim şablonundaki ${i + 1}. satırda zorunlu olan 'Adı' bilgisi eksik.`, "error");
              setUploadProgress(null);
              return;
            }
            if (!soyad) {
              showToast(`Yükleme İptal Edildi: Eğitim şablonundaki ${i + 1}. satırda zorunlu olan 'Soyadı' bilgisi eksik.`, "error");
              setUploadProgress(null);
              return;
            }
            if (!email || !emailRegex.test(email)) {
              showToast(`Yükleme İptal Edildi: Eğitim şablonundaki ${i + 1}. satırdaki '${email}' geçerli bir e-posta formatı değil.`, "error");
              setUploadProgress(null);
              return;
            }

            json.push({
              "Adı": ad,
              "Soyadı": soyad,
              "Email": email,
              "Firma Bilgisi": firma,
              "Telefon": telefon
            });
          }
        } else if (uploadType === "exam") {
          const idxEmail = getColumnIndex(["email", "e-posta", "eposta", "e-mail"]);
          const idxPuan = getColumnIndex(["sınav puanı", "puan", "score", "not", "sınav notu", "puanı", "toplam puan", "total score"]);
          const idxAd = getColumnIndex(["adı", "ad", "firstname", "first name", "name", "isim", "adınız"]);
          const idxSoyad = getColumnIndex(["soyadı", "soyad", "lastname", "last name", "soyisim", "soyadınız"]);
          const idxFirma = getColumnIndex(["firma bilgisi", "firma", "kurum", "company", "şirket", "sirket", "firma adı", "kurum adı", "organization", "bayi", "bayi adı"]);
          const idxTelefon = getColumnIndex(["telefon", "phone", "tel", "cep", "cep telefonu", "mobile"]);

          if (idxEmail === -1 || idxPuan === -1) {
            showToast("Yükleme İptal Edildi: Sınav şablonunda 'Email' veya 'Sınav Puanı' sütunu eksik.", "error");
            setUploadProgress(null);
            return;
          }

          for (let i = headerRowIndex + 1; i < rowsAsArrays.length; i++) {
            const rowData = rowsAsArrays[i];
            if (!rowData || !rowData.some(cell => String(cell).trim() !== "")) continue;
            
            const email = String(rowData[idxEmail] || "").trim();
            const puanRaw = String(rowData[idxPuan] || "").trim();
            const ad = idxAd !== -1 ? String(rowData[idxAd] || "").trim() : "";
            const soyad = idxSoyad !== -1 ? String(rowData[idxSoyad] || "").trim() : "";
            const firma = idxFirma !== -1 ? String(rowData[idxFirma] || "").trim() : "";
            const telefon = idxTelefon !== -1 ? String(rowData[idxTelefon] || "").trim() : "";
            
            if (!email || !emailRegex.test(email)) {
              showToast(`Yükleme İptal Edildi: Sınav şablonundaki ${i + 1}. satırdaki '${email}' geçerli bir e-posta formatı değil.`, "error");
              setUploadProgress(null);
              return;
            }
            
            if (puanRaw !== "" && isNaN(Number(puanRaw))) {
              // We allow text like 'Katılmadı', 'Girmedi', '-' to pass through
              const validTextStatuses = ["katılmadı", "girmedi", "giriş yapmadı", "-", "yok"];
              if (!validTextStatuses.includes(puanRaw.toLowerCase())) {
                 showToast(`Yükleme İptal Edildi: Sınav şablonundaki ${i + 1}. satırda 'Sınav Puanı' bilgisi geçersiz ('${puanRaw}').`, "error");
                 setUploadProgress(null);
                 return;
              }
            }

            json.push({
              "Adı": ad,
              "Soyadı": soyad,
              "Email": email,
              "Firma Bilgisi": firma,
              "Telefon": telefon,
              "Puan": puanRaw
            });
          }
        }
        
        setUploadProgress(90);
        setParsedRows(json);
        setUploadProgress(100);
        showToast(`${file.name} başarıyla doğrulandı ve yüklendi!`, "success");
        setUploadStatusMsg(`${file.name} başarıyla çözümlendi!`);
        
        setTimeout(() => {
          setUploadProgress(null);
        }, 1500);
      } catch (err: any) {
        console.error("Error reading file:", err);
        setUploadProgress(null);
        showToast(`Hata: ${err.message || "Excel dosyası okunamadı."}`, "error");
      }
    };
    
    reader.readAsBinaryString(file);
  };

  // Download Template Handler
  const handleDownloadTemplate = () => {
    const wb = utils.book_new();
    let ws;
    let fileName = "";

    if (uploadType === "event" || uploadType === "invitee") {
      ws = utils.aoa_to_sheet([
        ["Ad", "Soyad", "E-Posta", "Telefon", "Firma"],
        ["Ahmet", "Arık", "ahmet.arik@tp-link.com", "05551234567", "TP-Link"]
      ]);
      fileName = uploadType === "invitee" ? "Davetli_Sablonu.xlsx" : "Egitim_Katilim_Sablonu.xlsx";
    } else {
      ws = utils.aoa_to_sheet([
        ["Ad", "Soyad", "E-Posta", "Telefon", "Firma", "Puan"],
        ["Örnek", "Kullanıcı", "ornek@tp-link.com", "05551234567", "TP-Link", "65"]
      ]);
      fileName = "Sinav_Sonuc_Sablonu.xlsx";
    }

    utils.book_append_sheet(wb, ws, "Şablon");
    writeFile(wb, fileName);
  };

  // Save imported rows to database (Firebase)
  const saveImportedData = async () => {
    if (parsedRows.length === 0) return;
    try {
      setLoading(true);
      
      let batch = writeBatch(db);
      let operationCount = 0;
      let processed = 0;

      const commitBatchIfNeeded = async () => {
        if (operationCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      };

      if (uploadType === "event" || uploadType === "invitee") {
        const generatedEventName = targetEventForUpload ? targetEventForUpload.name : (eventFormData.content || eventFormData.eventType || "Genel Eğitim");
        const eventDate = targetEventForUpload && targetEventForUpload.date ? targetEventForUpload.date.split("T")[0] : (eventFormData.date ? eventFormData.date.split("T")[0] : "NoDate");
        const eventId = targetEventForUpload ? targetEventForUpload.id : `${generatedEventName.replace(/[^a-zA-Z0-9]/g, "")}-${eventDate}`;
        const attendanceStatus = uploadType === "invitee" ? "Davetli" : "Katıldı";
        
        for (const row of parsedRows) {
          const firstName = row["Adı"];
          const lastName = row["Soyadı"];
          const email = row["Email"];
          const company = row["Firma Bilgisi"];
          const phone = row["Telefon"];
          
          if (!firstName || !lastName) continue;
          
          const userId = email ? email.replace(/[^a-zA-Z0-9]/g, "") : `${firstName}${lastName}`.replace(/[^a-zA-Z0-9]/g, "");
          const existingUser = users.find(u => u.id === userId);
          
          // Check if this attendance already exists to handle upgrades (Davetli -> Katıldı)
          let existingAttendances = existingUser?.attendances || [];
          let currentAttendance = existingAttendances.find(a => a.event.id === eventId);
          
          let updatedAttendances = [...existingAttendances];
          
          if (currentAttendance) {
            // Upgrade to "Katıldı" if it was "Davetli" and we are uploading an "event" list
            if (attendanceStatus === "Katıldı") {
               currentAttendance.attendanceStatus = "Katıldı";
            }
          } else {
            updatedAttendances.push({
              id: `${userId}-${eventId}`,
              attendanceStatus: attendanceStatus,
              event: { id: eventId, name: generatedEventName, date: eventFormData.date || new Date().toISOString() }
            });
          }

          let updatedData: any = {
            firstName, lastName, email, phone,
            attendances: updatedAttendances
          };

          if (company && (!existingUser || existingUser.company !== company)) {
            updatedData.company = company;
          }

          const userRef = doc(db, "users", userId);
          batch.set(userRef, updatedData, { merge: true });
          operationCount++;

          const eventRef = doc(db, "events", eventId);
          const eventDataToSave: any = {
            name: generatedEventName
          };

          if (uploadType === "event") {
            eventDataToSave.attendances = arrayUnion({
              id: `${userId}-${eventId}`,
              attendanceStatus: attendanceStatus,
              user: { id: userId, firstName, lastName, email, company }
            });
          }
          
          if (!targetEventForUpload) {
            eventDataToSave.date = eventFormData.date || new Date().toISOString();
            eventDataToSave.eventType = eventFormData.eventType;
            eventDataToSave.trainer = eventFormData.trainer;
            eventDataToSave.purpose = eventFormData.purpose;
            eventDataToSave.content = eventFormData.content;
            eventDataToSave.description = eventFormData.description;
          }
          
          batch.set(eventRef, eventDataToSave, { merge: true });
          operationCount++;
          
          processed++;
          await commitBatchIfNeeded();
        }
        setUploadStatusMsg(`Başarılı! ${processed} kişi "${generatedEventName}" etkinliğine ${uploadType === "invitee" ? "davetli" : "katılımcı"} olarak eklendi.`);
      } else if (uploadType === "exam") {
        const uploadedEmails = parsedRows.map(r => String(r["Email"]).toLowerCase()).filter(Boolean);
        const passingScore = 60; // Geçme Notu 60 olarak baz alınmıştır
        const examName = examUploadData.examName;

        for (const row of parsedRows) {
          const email = row["Email"];
          if (!email) continue;
          const lowerEmail = email.toLowerCase();
          
          const existingUser = users.find(u => u.email?.toLowerCase() === lowerEmail);
          if (!existingUser) continue; 
          
          let scoreStr = row["Puan"] || "";
          scoreStr = scoreStr.toString().trim();
          let status = "";
          let resultStatus = "Kaldı";
          let finalScore: number | string = "-";
          
          const textLower = scoreStr.toLowerCase();
          const isAbsent = ["katılmadı", "girmedi", "giriş yapmadı", "-", "yok", "0", ""].includes(textLower);

          if (isAbsent) {
            status = "Sınava Katılmadı";
            resultStatus = "Sınava Katılmadı";
            finalScore = "-";
          } else {
            const score = parseFloat(scoreStr);
            finalScore = score;
            if (score >= passingScore) {
              status = "Sınava Girdi - Başarılı";
              resultStatus = "Geçti";
            } else {
              status = "Sınava Girdi - Başarısız";
              resultStatus = "Kaldı";
            }
          }
          
          const userRef = doc(db, "users", existingUser.id);
          
          const newExamResult = {
             id: `exam-${Date.now()}-${Math.random().toString(36).substring(7)}`,
             exam: {
               id: `exam-${examName.replace(/[^a-zA-Z0-9]/g, "")}`,
               name: examName,
               passingScore: passingScore
             },
             score: finalScore,
             status: resultStatus,
             date: new Date().toISOString()
          };

          const existingResults = existingUser.examResults || [];
          const filteredResults = existingResults.filter(r => r.exam.name !== examName);
          const updatedResults = [...filteredResults, newExamResult];

          batch.update(userRef, { examStatus: status, examResults: updatedResults });
          operationCount++;
          processed++;
          await commitBatchIfNeeded();
        }

        // Check absentees
        for (const user of users) {
          if (user.examStatus === "Sınava Davet Edildi" && user.email && !uploadedEmails.includes(user.email.toLowerCase())) {
            const userRef = doc(db, "users", user.id);
            batch.update(userRef, { examStatus: "Sınava Katılmadı" });
            operationCount++;
            await commitBatchIfNeeded();
          }
        }
        setUploadStatusMsg(`Başarılı! ${processed} sınav sonucu işlendi.`);
      }

      if (operationCount > 0) {
        await batch.commit();
      }
      
      setParsedRows([]);
      setIsEventModalOpen(false);
      setTargetEventForUpload(null);
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

  // Export Data to Excel
  const handleExportExcel = () => {
    // 1. Filtreleme İşlemi (AND mantığı)
    const startTimestamp = exportFilters.startDate ? new Date(exportFilters.startDate).getTime() : 0;
    // Bitiş tarihinin sonuna (23:59:59) kadar kapsaması için +86400000 ms ekliyoruz
    const endTimestamp = exportFilters.endDate ? new Date(exportFilters.endDate).getTime() + 86400000 : Infinity;

    const filteredUsers = users.filter(user => {
      let matches = true;

      // a. Firma Filtresi
      if (exportFilters.companyName !== "Tümü") {
        if (exportFilters.companyName === "Serbest / Tanımsız") {
          if (user.company && user.company.trim() !== "") matches = false;
        } else {
          if (user.company !== exportFilters.companyName) matches = false;
        }
      }

      // b. Sınav Durumu Filtresi
      if (exportFilters.examStatus !== "Tümü") {
        if (user.examStatus !== exportFilters.examStatus) matches = false;
      }

      // c. Etkinlik (Webinar) ve Tarih Filtresi
      // Her kullanıcının katıldığı eğitimlere (attendances) bakarak eşleşen var mı kontrol ediyoruz.
      if (exportFilters.eventName !== "Tümü" || exportFilters.startDate || exportFilters.endDate) {
        if (!user.attendances || user.attendances.length === 0) {
          matches = false;
        } else {
          // Kullanıcının etkinliklerinden herhangi biri seçili kriterleri karşılıyor mu?
          const hasMatchingEvent = user.attendances.some(a => {
            const eventDateTimestamp = new Date(a.event.date).getTime();
            const dateMatch = eventDateTimestamp >= startTimestamp && eventDateTimestamp <= endTimestamp;
            const nameMatch = exportFilters.eventName === "Tümü" || a.event.name === exportFilters.eventName;
            return dateMatch && nameMatch;
          });
          if (!hasMatchingEvent) matches = false;
        }
      }

      return matches;
    });

    // Kısım 1: Eğitim ve Profil Verileri
    const profileData = filteredUsers.map(user => {
      const attendances = user.attendances?.length > 0 ? user.attendances.map(a => a.event.name).join(", ") : "Katılım Yok";
      return {
        "Ad": user.firstName,
        "Soyad": user.lastName,
        "Kurum / Şube": user.company || "Serbest / Tanımsız",
        "E-Posta": user.email || "Tanımsız",
        "Telefon": user.phone || "Tanımsız",
        "Katıldığı Eğitimler": attendances,
      };
    });

    // Kısım 2: Sınav ve Performans İstatistikleri (Sadece sınava davet edilenler veya statüsü olanlar)
    const examData = filteredUsers
      .filter(user => user.examStatus)
      .map(user => {
        const attendances = user.attendances?.length > 0 ? user.attendances.map(a => a.event.name).join(", ") : "Katılım Yok";
        return {
          "Ad Soyad": `${user.firstName} ${user.lastName}`,
          "Kurum / Şube": user.company || "Serbest / Tanımsız",
          "Katıldığı Eğitimler": attendances,
          "Sınav Durumu": user.examStatus || "Durum Belirsiz"
        };
      });

    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(profileData.length > 0 ? profileData : [{ "Bilgi": "Seçilen filtrelere uygun katılımcı bulunamadı." }]);
    const ws2 = utils.json_to_sheet(examData.length > 0 ? examData : [{ "Bilgi": "Seçilen filtrelere uygun ve sınav durumu atanmış kullanıcı bulunamadı." }]);

    utils.book_append_sheet(wb, ws1, "Eğitim ve Profil Verileri");
    utils.book_append_sheet(wb, ws2, "Sınav İstatistikleri");

    writeFile(wb, "TPLink_Akademi_Rapor.xlsx");
    setIsExportModalOpen(false); // Kapat
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
      await setDoc(userRef, { examResults: updatedResults, examStatus: "Sınava Davet Edildi" }, { merge: true });
      
      await fetchData();
      
      setShowAssignForm(false);
      setNewExamName("");
      setSelectedUser(prev => prev ? { ...prev, examResults: updatedResults, examStatus: "Sınava Davet Edildi" } : null);
      
    } catch (error) {
      console.error("Error assigning exam:", error);
    }
  };

  const handleCertificateExport = () => {
    // Determine which users to include based on examType filter
    const targetUsers = certificateExportFilters.examType === "Tümü" 
      ? users.filter(u => (u.examResults && u.examResults.length > 0) || u.examStatus === "Sınava Davet Edildi")
      : users.filter(u => 
          (u.examResults && u.examResults.some(r => r.exam.name === certificateExportFilters.examType)) ||
          // Check if they were invited to this exam's event
          (u.attendances?.some(a => a.event.exams?.some(ex => ex.name === certificateExportFilters.examType)))
        );
        
    const filteredUsers = targetUsers.filter(u => {
      let matches = true;
      if (certificateExportFilters.companyName !== "Tümü") {
        if (certificateExportFilters.companyName === "Serbest / Tanımsız") {
          if (u.company && u.company.trim() !== "") matches = false;
        } else {
          if (u.company !== certificateExportFilters.companyName) matches = false;
        }
      }
      return matches;
    });

    const exportData = filteredUsers.flatMap(u => {
      const resultsForUser: {examName: string, score: string|number, status: string}[] = [];
      
      if (certificateExportFilters.examType === "Tümü") {
        u.examResults?.forEach(r => {
          resultsForUser.push({
            examName: r.exam.name,
            score: r.score,
            status: r.status // Geçti or Kaldı
          });
        });
        
        if (!u.examResults?.length && u.examStatus === "Sınava Davet Edildi") {
          resultsForUser.push({
            examName: "Belirtilmemiş",
            score: "-",
            status: "Sınava Katılmadı"
          });
        }
      } else {
        const r = u.examResults?.find(r => r.exam.name === certificateExportFilters.examType);
        if (r) {
          resultsForUser.push({
            examName: r.exam.name,
            score: r.score,
            status: r.status
          });
        } else {
          resultsForUser.push({
            examName: certificateExportFilters.examType,
            score: "-",
            status: "Sınava Katılmadı"
          });
        }
      }
      
      return resultsForUser.map(r => ({
        "Adı": u.firstName,
        "Soyadı": u.lastName,
        "Firma İsmi": u.company || "Serbest / Tanımsız",
        "E-posta": u.email || "Tanımsız",
        "Sınav Adı": r.examName,
        "Sınav Puanı": r.score,
        "Sınav Durumu": r.status,
      }));
    }).filter(row => {
      if (certificateExportFilters.examStatus === "Tümü") return true;
      if (certificateExportFilters.examStatus === "Geçti") return row["Sınav Durumu"] === "Geçti";
      if (certificateExportFilters.examStatus === "Kaldı") return row["Sınav Durumu"] === "Kaldı";
      if (certificateExportFilters.examStatus === "Katılmadı") return row["Sınav Durumu"] === "Sınava Katılmadı";
      return true;
    });

    const wb = utils.book_new();
    const ws = utils.json_to_sheet(exportData.length > 0 ? exportData : [{ "Bilgi": "Seçilen filtrelere uygun kullanıcı bulunamadı." }]);
    utils.book_append_sheet(wb, ws, "Sınav Raporu");
    writeFile(wb, "Sinav_Raporu.xlsx");
    setIsCertificateExportModalOpen(false);
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent || !editingEventData) return;
    try {
      const dbUrl = "http://localhost:3000"; // Assuming local node or firebase
      // Update local state first for immediate UI feedback
      const updatedEvents = events.map(e => e.id === selectedEvent.id ? { ...e, ...editingEventData } : e);
      setEvents(updatedEvents);
      setSelectedEvent({ ...selectedEvent, ...editingEventData });
      showToast("Etkinlik bilgileri güncellendi", "success");
    } catch (error) {
      console.error(error);
      showToast("Güncelleme hatası", "error");
    }
  };

  const handleToggleAttendance = async (userId: string, currentStatus?: string) => {
    if (!selectedEvent) return;
    try {
      const newStatus = currentStatus === "Katıldı" ? "Katılmadı" : "Katıldı";
      
      // Update locally
      const updatedEvents = events.map(e => {
        if (e.id === selectedEvent.id) {
          return {
            ...e,
            attendances: e.attendances.map(a => a.user.id === userId ? { ...a, attendanceStatus: newStatus } : a)
          };
        }
        return e;
      });
      setEvents(updatedEvents);
      
      const updatedSelectedEvent = updatedEvents.find(e => e.id === selectedEvent.id);
      if (updatedSelectedEvent) setSelectedEvent(updatedSelectedEvent);
      
      // We would update Firebase here in a real app
    } catch (error) {
      console.error(error);
    }
  };

  const handleQuickAddParticipant = async () => {
    if (!selectedEvent || !quickAddParticipant.firstName || !quickAddParticipant.email) {
      showToast("Lütfen Ad ve Email alanlarını doldurun", "error");
      return;
    }
    
    // Check if user exists
    let existingUser = users.find(u => u.email === quickAddParticipant.email);
    
    // Simulate updating locally
    setTimeout(() => {
      showToast("Kayıt oluşturdunuz: " + quickAddParticipant.email + " adresine bilgilendirme maili gönderildi.", "success");
      setQuickAddParticipant({ firstName: "", lastName: "", email: "", phone: "" });
    }, 500);
  };

  // Sınav tanımla sistemi kaldırıldı

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
            onClick={() => { setActiveTab("invitees"); setSelectedEvent(null); setSelectedUser(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
              activeTab === "invitees" 
                ? "active-nav font-semibold" 
                : "text-[#b5bac1] discord-hover"
            }`}
          >
            <Mail className="w-4 h-4 text-[#80848e] group-hover:text-white transition-colors" />
            <span>Davetliler</span>
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
                    <span className="text-3xl font-bold text-white">
                      {users.reduce((acc, u) => acc + (u.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0), 0)}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Eğitimlere yapılan toplam kayıt</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Uniq Katılımcı</span>
                    <span className="text-3xl font-bold text-white">{sortedUsers.length}</span>
                    <span className="text-xs text-[#b5bac1] mt-1">Sisteme kayıtlı tekil kullanıcı</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Katılım / Tekil Oranı</span>
                    <span className="text-3xl font-bold text-white">
                      {sortedUsers.length > 0 ? (users.reduce((acc, u) => acc + (u.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0), 0) / sortedUsers.length).toFixed(1) : "0"}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Kişi başı ortalama eğitim sayısı</span>
                  </div>
                </div>
              )}

              {activeTab === "invitees" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Davetli</span>
                    <span className="text-3xl font-bold text-white">
                      {users.reduce((acc, u) => acc + (u.attendances?.length || 0), 0)}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Sisteme yüklenen tüm davetler</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Toplam Katılım</span>
                    <span className="text-3xl font-bold text-white">
                      {users.reduce((acc, u) => acc + (u.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0), 0)}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Gerçekleşen toplam katılım</span>
                  </div>
                  <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Toplam Katılmayan</span>
                    <span className="text-3xl font-bold text-white">
                      {users.reduce((acc, u) => acc + (u.attendances?.filter(a => a.attendanceStatus === "Davetli").length || 0), 0)}
                    </span>
                    <span className="text-xs text-[#b5bac1] mt-1">Henüz katılım sağlamamış davetliler</span>
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
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Toplam Davetli</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">
                          {users.reduce((acc, u) => acc + (u.attendances?.length || 0), 0)}
                        </span>
                      </div>
                      <span className="text-xs text-[#b5bac1] mt-1">Sisteme yüklenen tüm davetler</span>
                    </div>

                    <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-xl group-hover:bg-green-500/10 transition-colors duration-300"></div>
                      <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Toplam Katılımcı</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">
                          {users.reduce((acc, u) => acc + (u.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0), 0)}
                        </span>
                      </div>
                      <span className="text-xs text-[#b5bac1] mt-1">Gerçekleşen toplam katılım</span>
                    </div>

                    <div className="bg-[#313338] p-5 rounded-lg anti-gravity flex flex-col gap-1.5 border border-[#36373d]/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-xl group-hover:bg-yellow-500/10 transition-colors duration-300"></div>
                      <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Toplam Sınavı Geçenler</span>
                      <span className="text-3xl font-bold text-white">
                        {users.reduce((acc, u) => acc + (u.examResults?.filter(r => r.status === "Geçti").length || 0), 0)}
                      </span>
                      <span className="text-xs text-[#b5bac1] mt-1">Sınavı başarıyla tamamlayanlar</span>
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
              {activeTab === "invitees" && (
                <div className="bg-[#313338] rounded-lg flex flex-col anti-gravity overflow-hidden border border-[#36373d]/40">
                  <div className="p-5 border-b border-[#1e1f22] bg-[#2b2d31]/30 flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h3 className="text-white font-bold text-base">Davetli ve Katılımcı Listesi</h3>
                      <p className="text-xs text-gray-500">Etkinliklere davet edilen kişileri ve katılım durumlarını buradan takip edebilirsiniz.</p>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="İsim, e-posta veya kurum ara..." 
                          value={inviteeSearchTerm}
                          onChange={(e) => setInviteeSearchTerm(e.target.value)}
                          className="bg-[#1e1f22] border border-[#2b2d31] rounded-md px-4 py-1.5 pl-9 text-sm focus:outline-none focus:border-[#5865f2] w-64 text-white placeholder-gray-500 transition-all duration-300"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                      </div>
                      
                      <select 
                        value={inviteeEventFilter}
                        onChange={(e) => setInviteeEventFilter(e.target.value)}
                        className="bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#5865f2] text-white"
                      >
                        <option value="all">Tüm Etkinlikler</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                      </select>

                      <select 
                        value={inviteeStatusFilter}
                        onChange={(e) => setInviteeStatusFilter(e.target.value)}
                        className="bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#5865f2] text-white"
                      >
                        <option value="all">Tüm Durumlar</option>
                        <option value="Davetli">Davetli (Katılmadı)</option>
                        <option value="Katıldı">Katıldı</option>
                      </select>
                      {selectedInviteeIds.length > 0 && (
                        <button 
                          onClick={handleBulkDeleteInvitees}
                          className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded border border-red-500/20 font-bold text-xs transition-all flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Seçili {selectedInviteeIds.length} Kaydı Sil
                        </button>
                      )}
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <div className="w-12 h-12 border-4 border-[#5865f2] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-400">Veriler yükleniyor...</span>
                    </div>
                  ) : inviteesData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#1e1f22] flex items-center justify-center text-[#949ba4]">
                        <Mail className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-lg">Davetli Bulunamadı</h4>
                        <p className="text-xs text-gray-500 max-w-sm mt-1">
                          Arama terimiyle eşleşen sonuç yok veya sisteme henüz veri yüklenmemiş.
                        </p>
                      </div>
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
                                checked={inviteesData.length > 0 && selectedInviteeIds.length === inviteesData.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedInviteeIds(inviteesData.map(d => `${d.user.id}-${d.attendance.event.id}`));
                                  else setSelectedInviteeIds([]);
                                }}
                              />
                            </th>
                            <th className="px-6 py-4">Katılımcı / Davetli</th>
                            <th className="px-6 py-4">E-Posta</th>
                            <th className="px-6 py-4">Kurum / Şube</th>
                            <th className="px-6 py-4">Etkinlik</th>
                            <th className="px-6 py-4">Durum</th>
                            <th className="px-6 py-4 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300 divide-y divide-[#1e1f22]">
                          {inviteesData.map((data, idx) => {
                            const { user, attendance } = data;
                            const isKatildi = attendance.attendanceStatus === "Katıldı";
                            const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "TP";
                            const attendanceId = `${user.id}-${attendance.event.id}`;

                            return (
                              <tr 
                                key={`${attendanceId}-${idx}`} 
                                className="discord-hover transition-colors group cursor-pointer"
                                onClick={() => setSelectedUser(user)}
                              >
                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-[#36373d] bg-[#1e1f22] text-[#5865f2] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    checked={selectedInviteeIds.includes(attendanceId)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedInviteeIds([...selectedInviteeIds, attendanceId]);
                                      else setSelectedInviteeIds(selectedInviteeIds.filter(id => id !== attendanceId));
                                    }}
                                  />
                                </td>
                                <td className="px-6 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-[#5865f2]/20">
                                    {initials}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium group-hover:text-[#5865f2] transition-colors">{user.firstName} {user.lastName}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-[12px] text-gray-400 font-mono">{user.email || "-"}</td>
                                <td className="px-6 py-4 text-[#dbdee1]">{user.company || "Serbest / Tanımsız"}</td>
                                <td className="px-6 py-4 text-[#b5bac1] max-w-[200px] truncate" title={attendance.event.name}>
                                  {attendance.event.name}
                                </td>
                                <td className="px-6 py-4">
                                  {isKatildi ? (
                                    <span className="px-2.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase">KATILDI</span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px] font-bold border border-yellow-500/20 uppercase">DAVETLİ (KATILMADI)</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteInvitee(user.id, attendance.event.id); }}
                                      className="text-gray-500 hover:text-red-400 font-semibold text-xs transition-colors flex items-center p-1 rounded hover:bg-red-500/10"
                                      title="Kaydı Sil"
                                    >
                                      <Trash2 className="w-4 h-4" />
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
                      <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded border border-green-500/30 font-bold text-xs transition-all flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel'e Aktar
                      </button>
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
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                              <div className="flex items-center gap-1">Katılımcı <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('email')}>
                              <div className="flex items-center gap-1">E-Posta <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('company')}>
                              <div className="flex items-center gap-1">Kurum / Şube <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="px-6 py-4">Son Eğitim</th>
                            <th className="px-6 py-4">Durum</th>
                            <th className="px-6 py-4 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300 divide-y divide-[#1e1f22]">
                          {filteredUsers.map((user) => {
                            const actualAttendances = user.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus) || [];
                            const attendancesList = actualAttendances.length > 0 
                              ? actualAttendances.map(a => a.event.name).join(", ") 
                              : "Katılım Yok";
                            
                            let statusBadge = (
                              <span className="px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase">
                                EĞİTİMDE
                              </span>
                            );
                            
                            if (user.examStatus) {
                              if (user.examStatus === "Sınava Davet Edildi") {
                                statusBadge = <span className="px-2.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px] font-bold border border-yellow-500/20 uppercase">DAVET EDİLDİ</span>;
                              } else if (user.examStatus === "Sınava Girdi - Başarılı") {
                                statusBadge = <span className="px-2.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase">BAŞARILI</span>;
                              } else if (user.examStatus === "Sınava Girdi - Başarısız") {
                                statusBadge = <span className="px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20 uppercase">BAŞARISIZ</span>;
                              } else if (user.examStatus === "Sınava Katılmadı") {
                                statusBadge = <span className="px-2.5 py-0.5 rounded bg-gray-500/10 text-gray-400 text-[10px] font-bold border border-gray-500/20 uppercase">KATILMADI</span>;
                              } else {
                                statusBadge = <span className="px-2.5 py-0.5 rounded bg-gray-500/10 text-gray-400 text-[10px] font-bold border border-gray-500/20 uppercase">{user.examStatus}</span>;
                              }
                            } else {
                               const overallPassed = user.examResults?.length > 0 && user.examResults.every(r => r.status === "Geçti");
                               const hasFailed = user.examResults?.some(r => r.status === "Kaldı");
                               if (overallPassed) {
                                 statusBadge = <span className="px-2.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase">SERTİFİKALI</span>;
                               } else if (hasFailed) {
                                 statusBadge = <span className="px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20 uppercase">KALDI</span>;
                               } else if (user.attendances?.length === 1) {
                                 statusBadge = <span className="px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 uppercase">YENİ KAYIT</span>;
                               }
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
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-[12px] text-gray-400 font-mono">{user.email || "-"}</td>
                                <td className="px-6 py-4 text-[#dbdee1]">{user.company || "Serbest / Tanımsız"}</td>
                                <td className="px-6 py-4 font-mono text-[11px] text-[#b5bac1] max-w-[200px] truncate" title={attendancesList}>{attendancesList}</td>
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
                            onClick={() => { setSelectedEvent(event); setEditingEventData(event); }}
                            className="bg-[#2b2d31] border border-[#36373d] rounded-lg p-5 hover:border-[#5865f2]/40 hover:-translate-y-1 transition-all duration-300 relative group cursor-pointer"
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
                              <span className="text-gray-500">Katılımcı Sayısı: <strong className="text-white">{event.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0} kişi</strong></span>
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
                <div className="space-y-6">
                  <div className="bg-[#313338] rounded-lg p-6 border border-[#36373d]/40 anti-gravity">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-base">Sınav ve Sertifika Dashboard'u</h3>
                          <p className="text-xs text-gray-500">Sistemdeki tüm sınavların genel durumları, katılımcı ve başarı istatistikleri.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsCertificateExportModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-green-600/20"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> Sertifika Kazananları Raporla
                      </button>
                    </div>

                    {loading ? (
                      <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#5865f2] border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {(() => {
                          const stats: Record<string, { name: string, passingScore: number, invited: number, entered: number, passed: number, failed: number }> = {};
                          
                          // Fill exams from events
                          events.forEach(e => {
                            e.exams?.forEach(ex => {
                              if (!stats[ex.name]) {
                                stats[ex.name] = { name: ex.name, passingScore: ex.passingScore, invited: 0, entered: 0, passed: 0, failed: 0 };
                              }
                            });
                          });

                          // Aggregate from users
                          users.forEach(u => {
                            u.examResults?.forEach(r => {
                              if (!stats[r.exam.name]) {
                                stats[r.exam.name] = { name: r.exam.name, passingScore: r.exam.passingScore, invited: 0, entered: 0, passed: 0, failed: 0 };
                              }
                              stats[r.exam.name].entered++;
                              if (r.status === "Geçti") stats[r.exam.name].passed++;
                              if (r.status === "Kaldı") stats[r.exam.name].failed++;
                            });
                          });

                          const statsArray = Object.values(stats);
                          if (statsArray.length === 0) {
                            return <div className="col-span-full text-center py-8 text-gray-500">Kayıtlı sınav bulunamadı.</div>;
                          }

                          return statsArray.map((s, i) => (
                            <div key={i} className="bg-[#1e1f22] border border-[#36373d] rounded-lg p-5 hover:border-[#5865f2]/50 transition-colors group">
                              <h4 className="text-white font-bold text-lg mb-1 group-hover:text-[#5865f2] transition-colors">{s.name}</h4>
                              <p className="text-xs text-gray-500 mb-4">Geçme Notu: <strong className="text-white">{s.passingScore}</strong></p>
                              
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-[#2b2d31] p-3 rounded border border-[#36373d]">
                                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Sınava Giren</div>
                                  <div className="text-xl text-white font-bold">{s.entered}</div>
                                </div>
                                <div className="bg-[#2b2d31] p-3 rounded border border-[#36373d]">
                                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Sertifika Alan</div>
                                  <div className="text-xl text-green-400 font-bold">{s.passed}</div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2 text-xs">
                                <div className="flex-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded py-2 px-3 text-center font-bold flex flex-col justify-center">
                                  <span>Başarı Oranı</span>
                                  <span className="text-lg">{s.entered > 0 ? Math.round((s.passed / s.entered) * 100) : 0}%</span>
                                </div>
                                <div className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded py-2 px-3 text-center font-bold flex flex-col justify-center">
                                  <span>Başarısız</span>
                                  <span className="text-lg">{s.failed}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setCertificateExportFilters(prev => ({...prev, examType: s.name, examStatus: "Tümü"}));
                                  setIsCertificateExportModalOpen(true);
                                }}
                                className="w-full mt-4 bg-[#313338] hover:bg-[#36373d] border border-[#36373d] text-gray-300 hover:text-white font-bold text-xs py-2 rounded transition-colors flex justify-center items-center gap-2"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Bu Sınavı Raporla
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "upload" && (
                <div className="space-y-6">
                  
                  {/* Excel Upload Area matching the high-fidelity template */}
                  <div className="bg-[#313338] rounded-lg p-6 border border-[#36373d]/40 anti-gravity">
                    <h3 className="text-white font-bold text-base mb-1">Toplu Veri İçe Aktarma (Excel Sihirbazı)</h3>
                    <p className="text-xs text-gray-500 mb-6">TP-Link Akademi sınav sonuç listesini doğrudan yükleyerek kullanıcıları, katılımları ve sınav durumlarını saniyeler içinde güncelleyin.</p>

                    <div className="flex gap-4 mb-6 flex-wrap">
                      <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition-all ${uploadType === 'invitee' ? 'border-[#5865f2] bg-[#5865f2]/10' : 'border-[#36373d] bg-[#2b2d31]'}`}>
                        <input type="radio" name="uploadType" value="invitee" checked={uploadType === 'invitee'} onChange={() => setUploadType('invitee')} className="hidden" />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${uploadType === 'invitee' ? 'border-[#5865f2]' : 'border-gray-500'}`}>
                          {uploadType === 'invitee' && <div className="w-2 h-2 rounded-full bg-[#5865f2]"></div>}
                        </div>
                        <span className="text-sm font-bold text-white">Davetli Listesi</span>
                      </label>

                      <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition-all ${uploadType === 'exam' ? 'border-[#5865f2] bg-[#5865f2]/10' : 'border-[#36373d] bg-[#2b2d31]'}`}>
                        <input type="radio" name="uploadType" value="exam" checked={uploadType === 'exam'} onChange={() => setUploadType('exam')} className="hidden" />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${uploadType === 'exam' ? 'border-[#5865f2]' : 'border-gray-500'}`}>
                          {uploadType === 'exam' && <div className="w-2 h-2 rounded-full bg-[#5865f2]"></div>}
                        </div>
                        <span className="text-sm font-bold text-white">Sınav Sonuç Listesi</span>
                      </label>
                    </div>

                    {uploadType === "exam" && (
                      <div className="mb-6 space-y-1.5">
                        <label className="text-xs font-bold text-gray-400">Yüklenecek Sınavın Adı (Zorunlu)</label>
                        <input 
                          type="text" 
                          placeholder="Örn: Omada Expert V2" 
                          value={examUploadData.examName}
                          onChange={(e) => setExamUploadData({...examUploadData, examName: e.target.value})}
                          className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                    )}

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
                        <h4 className="text-white font-bold text-base">
                          {uploadType === 'invitee' ? 'Eğitim Davetli Excelini Sürükleyip Bırakın' :
                           uploadType === 'event' ? 'Eğitim Katılımcı Excelini Sürükleyip Bırakın' : 
                           'Sınav Sonuç Excelini Sürükleyip Bırakın'}
                        </h4>
                        <p className="text-xs text-gray-500 max-w-md">
                          {uploadType === 'exam' 
                            ? <><strong className="text-white">Ad, Soyad, E-Posta, Telefon, Firma, Puan</strong> sütunları bulunmalıdır.</>
                            : <><strong className="text-white">Ad, Soyad, E-Posta, Telefon, Firma</strong> sütunları bulunmalıdır.</>
                          }
                        </p>
                      </div>
                      <button 
                        type="button"
                        className="bg-[#5865f2] hover:bg-[#5865f2]/90 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-lg shadow-[#5865f2]/20 transition-all"
                      >
                        Bilgisayardan Dosya Seçin
                      </button>
                    </div>

                    <div className="mt-6 flex flex-col items-center gap-3">
                      {uploadType !== "exam" ? (
                        <p className="text-xs text-yellow-400 font-semibold bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20 text-center max-w-lg">
                          Sisteme yüklenecek verilerin eşleşebilmesi için lütfen örnek şablondaki sütun yapısını kullanın. Eğitim ve davetli listelerinde <strong>Adı, Soyadı ve Email</strong> alanları zorunludur.
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-400 font-semibold bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20 text-center max-w-lg">
                          Sisteme yüklenecek verilerin eşleşebilmesi için lütfen örnek şablondaki sütun yapısını kullanın. Sınav listelerinde <strong>Email ve Sınav Puanı</strong> alanları zorunludur.
                        </p>
                      )}
                      <button 
                        onClick={handleDownloadTemplate}
                        className="text-[#5865f2] hover:text-white text-xs font-bold transition-colors underline decoration-[#5865f2]/40 hover:decoration-white underline-offset-4"
                      >
                        {uploadType === "invitee" ? "Davetli Şablonunu İndir (.xlsx)" : 
                         uploadType === "event" ? "Eğitim Şablonunu İndir (.xlsx)" : 
                         "Sınav Şablonunu İndir (.xlsx)"}
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
                            onClick={() => {
                              if ((uploadType === "event" || uploadType === "invitee") && !targetEventForUpload) {
                                setIsEventModalOpen(true);
                              } else {
                                saveImportedData();
                              }
                            }}
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
                              {uploadType === "exam" && <th className="px-4 py-2.5">Puan</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e1f22]">
                            {parsedRows.map((row, i) => (
                              <tr key={i} className="hover:bg-[#36373d]/50">
                                <td className="px-4 py-2 text-white font-medium">
                                  {row["Adı"] || ""} {row["Soyadı"] || ""}
                                </td>
                                <td className="px-4 py-2 font-mono">{row["Email"] || "-"}</td>
                                <td className="px-4 py-2 font-mono">{row["Telefon"] || "-"}</td>
                                <td className="px-4 py-2">{row["Firma Bilgisi"] || "-"}</td>
                                {uploadType === "exam" && <td className="px-4 py-2 text-yellow-400 font-bold">{row["Puan"] || "0"}</td>}
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
                    
                    {!selectedUser.examResults || selectedUser.examResults.length === 0 ? (
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

      {/* EXPORT MODAL */}
      <AnimatePresence>
        {isExportModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-black/60 z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[#313338] border border-[#1e1f22] rounded-xl shadow-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-[#1e1f22] flex justify-between items-center bg-[#2b2d31]/50">
                <h2 className="text-white font-bold text-lg">Rapor Dışa Aktar</h2>
                <button onClick={() => setIsExportModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Başlangıç Tarihi</label>
                    <input 
                      type="date" 
                      value={exportFilters.startDate} onChange={e => setExportFilters({...exportFilters, startDate: e.target.value})}
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400">Bitiş Tarihi</label>
                    <input 
                      type="date" 
                      value={exportFilters.endDate} onChange={e => setExportFilters({...exportFilters, endDate: e.target.value})}
                      className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Etkinlik / Webinar</label>
                  <select 
                    value={exportFilters.eventName} onChange={e => setExportFilters({...exportFilters, eventName: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü</option>
                    {Array.from(new Set(events.map(e => e.name))).map((name, i) => <option key={i} value={name}>{name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Sınav Durumu</label>
                  <select 
                    value={exportFilters.examStatus} onChange={e => setExportFilters({...exportFilters, examStatus: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü</option>
                    <option value="Sınava Girdi - Başarılı">Sınava Girdi - Başarılı</option>
                    <option value="Sınava Girdi - Başarısız">Sınava Girdi - Başarısız</option>
                    <option value="Sınava Katılmadı">Davet Edildi - Katılmadı</option>
                    <option value="Sınava Davet Edildi">Sınava Davet Edildi</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Firma Adı</label>
                  <select 
                    value={exportFilters.companyName} onChange={e => setExportFilters({...exportFilters, companyName: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü</option>
                    {Array.from(new Set(users.map(u => u.company).filter(c => c && c.trim() !== ""))).sort().map((company, i) => (
                      <option key={i} value={company}>{company}</option>
                    ))}
                    <option value="Serbest / Tanımsız">Serbest / Tanımsız</option>
                  </select>
                </div>
              </div>

              <div className="p-5 border-t border-[#1e1f22] bg-[#2b2d31]/50 flex justify-end gap-3">
                <button onClick={() => setIsExportModalOpen(false)} className="px-5 py-2 rounded-md bg-[#36373d] text-white text-sm font-semibold hover:bg-[#36373d]/80 transition-colors">
                  İptal
                </button>
                <button onClick={handleExportExcel} className="px-5 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Dışa Aktar (.xlsx)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CERTIFICATE EXPORT MODAL */}
      <AnimatePresence>
        {isCertificateExportModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setIsCertificateExportModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#2b2d31] rounded-xl shadow-2xl z-50 flex flex-col border border-[#1e1f22] overflow-hidden"
            >
              <div className="p-5 border-b border-[#1e1f22] flex justify-between items-center bg-[#313338]">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-500" />
                  Detaylı Sınav Raporu
                </h3>
                <button onClick={() => setIsCertificateExportModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 bg-[#2b2d31]">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 font-medium">
                  Bu ekrandan seçtiğiniz sınav türüne ve başarı durumuna göre detaylı rapor alabilirsiniz.
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Sertifika / Sınav Adı</label>
                  <select 
                    value={certificateExportFilters.examType} onChange={e => setCertificateExportFilters({...certificateExportFilters, examType: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü</option>
                    {Array.from(new Set(events.flatMap(e => e.exams || []).map(ex => ex.name))).map((name, i) => <option key={i} value={name}>{name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Sınav Durumu</label>
                  <select 
                    value={certificateExportFilters.examStatus} onChange={e => setCertificateExportFilters({...certificateExportFilters, examStatus: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü (Tüm Durumlar)</option>
                    <option value="Geçti">Başarılı / Sertifika Aldı</option>
                    <option value="Kaldı">Başarısız / Kaldı</option>
                    <option value="Katılmadı">Davet Edildi ama Katılmadı</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400">Firma Adı</label>
                  <select 
                    value={certificateExportFilters.companyName} onChange={e => setCertificateExportFilters({...certificateExportFilters, companyName: e.target.value})}
                    className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-md px-3 py-2 text-sm text-white focus:border-[#5865f2] focus:outline-none"
                  >
                    <option value="Tümü">Tümü</option>
                    {Array.from(new Set(users.map(u => u.company).filter(c => c && c.trim() !== ""))).sort().map((company, i) => (
                      <option key={i} value={company}>{company}</option>
                    ))}
                    <option value="Serbest / Tanımsız">Serbest / Tanımsız</option>
                  </select>
                </div>
              </div>

              <div className="p-5 border-t border-[#1e1f22] bg-[#2b2d31]/50 flex justify-end gap-3">
                <button onClick={() => setIsCertificateExportModalOpen(false)} className="px-5 py-2 rounded-md bg-[#36373d] text-white text-sm font-semibold hover:bg-[#36373d]/80 transition-colors">
                  İptal
                </button>
                <button onClick={handleCertificateExport} className="px-5 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Dışa Aktar (.xlsx)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 6. EVENT DETAIL MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedEvent(null); setEditingEventData(null); }}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 md:inset-10 lg:inset-20 bg-[#2b2d31] rounded-xl shadow-2xl z-50 flex flex-col border border-[#1e1f22] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#1e1f22] flex justify-between items-center bg-[#313338]/40 shrink-0">
                <h2 className="text-white font-bold text-xl flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#5865f2]" />
                  Etkinlik Detay ve Düzenleme
                </h2>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    id="modalFileInput"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setTargetEventForUpload(selectedEvent);
                        setUploadType("event");
                        setActiveTab("upload");
                        setSelectedEvent(null);
                        processFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="modalFileInput" className="cursor-pointer px-4 py-2 bg-[#5865f2] hover:bg-[#5865f2]/90 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Katılımcı Listesi Ekle
                  </label>
                  <button onClick={handleUpdateEvent} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Değişiklikleri Kaydet
                  </button>
                  <button onClick={() => { setSelectedEvent(null); setEditingEventData(null); }} className="text-gray-500 hover:text-white hover:bg-[#36373d] p-1.5 rounded-md transition-colors">
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
                
                {/* Left Col: Event Details */}
                <div className="w-full md:w-1/3 space-y-6">
                  <div className="bg-[#1e1f22] p-5 rounded-lg border border-[#36373d] space-y-4">
                    <h3 className="text-white font-bold text-sm border-b border-[#36373d] pb-2">Etkinlik Bilgileri</h3>
                    
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-bold">Etkinlik Adı</label>
                      <input type="text" value={editingEventData?.name || ""} onChange={e => setEditingEventData({...editingEventData, name: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-sm text-white focus:border-[#5865f2] focus:outline-none" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-bold">Başlangıç Tarihi</label>
                        <input type="date" value={editingEventData?.date || ""} onChange={e => setEditingEventData({...editingEventData, date: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-sm text-white focus:border-[#5865f2] focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 font-bold">Bitiş Tarihi</label>
                        <input type="date" value={editingEventData?.endDate || ""} onChange={e => setEditingEventData({...editingEventData, endDate: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-sm text-white focus:border-[#5865f2] focus:outline-none" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-bold">Saat Aralığı</label>
                      <input type="text" placeholder="Örn: 10:00 - 12:30" value={editingEventData?.timeRange || ""} onChange={e => setEditingEventData({...editingEventData, timeRange: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-sm text-white focus:border-[#5865f2] focus:outline-none" />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 font-bold">Konum / Link</label>
                      <input type="text" placeholder="Örn: Online Zoom Portalı" value={editingEventData?.location || ""} onChange={e => setEditingEventData({...editingEventData, location: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-sm text-white focus:border-[#5865f2] focus:outline-none" />
                    </div>
                  </div>

                  {/* Add Participant block */}
                  <div className="bg-[#1e1f22] p-5 rounded-lg border border-[#36373d] space-y-4">
                    <h3 className="text-white font-bold text-sm border-b border-[#36373d] pb-2">Hızlı Katılımcı Ekle</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="Ad" value={quickAddParticipant.firstName} onChange={e => setQuickAddParticipant({...quickAddParticipant, firstName: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-xs text-white" />
                      <input type="text" placeholder="Soyad" value={quickAddParticipant.lastName} onChange={e => setQuickAddParticipant({...quickAddParticipant, lastName: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-xs text-white" />
                    </div>
                    <input type="email" placeholder="E-Posta (Zorunlu)" value={quickAddParticipant.email} onChange={e => setQuickAddParticipant({...quickAddParticipant, email: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-xs text-white" />
                    <input type="text" placeholder="Telefon (Opsiyonel)" value={quickAddParticipant.phone} onChange={e => setQuickAddParticipant({...quickAddParticipant, phone: e.target.value})} className="w-full bg-[#2b2d31] border border-[#36373d] rounded p-2 text-xs text-white" />
                    <div className="flex gap-2">
                      <button onClick={handleQuickAddParticipant} className="flex-1 bg-[#5865f2] hover:bg-[#5865f2]/80 text-white font-bold text-xs py-2 rounded transition-colors flex justify-center items-center gap-2">
                        <Plus className="w-3 h-3" /> Tekli Ekle
                      </button>
                      <button onClick={() => { setSelectedEvent(null); setActiveTab("upload"); setUploadType("event"); }} className="flex-1 bg-[#313338] hover:bg-[#36373d] text-white font-bold text-xs py-2 rounded border border-[#36373d] transition-colors flex justify-center items-center gap-2">
                        <UploadCloud className="w-3 h-3" /> Toplu (Excel)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Col: Participant List & Attendance */}
                <div className="w-full md:w-2/3 flex flex-col space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-white font-bold text-lg">Katılımcı Yönetimi ve Yoklama</h3>
                      <p className="text-xs text-gray-400">Bu eğitime kayıtlı {selectedEvent.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length || 0} kişi bulunuyor. Eğitime fiilen katılanları işaretleyin.</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-[#1e1f22] border border-[#36373d] rounded-lg overflow-hidden flex flex-col">
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#2b2d31] sticky top-0 z-10 border-b border-[#36373d]">
                          <tr>
                            <th className="px-4 py-3 text-xs font-bold text-gray-400 w-16 text-center">Durum</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-400">Ad Soyad</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-400">E-Posta</th>
                            <th className="px-4 py-3 text-xs font-bold text-gray-400">Firma</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b2d31]">
                          {selectedEvent.attendances?.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).map((att, i) => (
                            <tr key={i} className="hover:bg-[#2b2d31]/50 transition-colors">
                              <td className="px-4 py-3 text-center">
                                <button 
                                  onClick={() => handleToggleAttendance(att.user.id, att.attendanceStatus)}
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${att.attendanceStatus === "Katıldı" ? "bg-green-500 border-green-500 text-white" : "border-gray-500 text-transparent hover:border-green-500"}`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-white font-medium">{att.user.firstName} {att.user.lastName}</td>
                              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{att.user.email || "-"}</td>
                              <td className="px-4 py-3 text-xs text-gray-400">{att.user.company || "-"}</td>
                            </tr>
                          ))}
                          {(!selectedEvent.attendances || selectedEvent.attendances.filter(a => a.attendanceStatus === "Katıldı" || !a.attendanceStatus).length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Bu etkinliğe henüz katılımcı eklenmemiş. Sadece davetliler olabilir.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -50, x: 50 }}
            className={`fixed top-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-2xl border flex items-start gap-3 max-w-md ${
              toastMessage.type === "error" 
                ? "bg-red-500/10 border-red-500/30 text-red-400 backdrop-blur-md" 
                : "bg-green-500/10 border-green-500/30 text-green-400 backdrop-blur-md"
            }`}
          >
            <div className="mt-0.5">
              {toastMessage.type === "error" ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">{toastMessage.type === "error" ? "Hata: Yükleme İptal Edildi" : "Başarılı"}</h4>
              <p className="text-xs opacity-90 leading-relaxed">{toastMessage.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
