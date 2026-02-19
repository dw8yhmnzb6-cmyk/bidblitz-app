/**
 * CreditSystem - Kredit-System für BidBlitz Pay
 * Nutzer können Kredite beantragen, Dokumente hochladen, und Rückzahlungen leisten
 * Inkl. Kredit-Score System mit Stufen und Vorteilen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Upload, FileText, Camera, CheckCircle, XCircle,
  Clock, AlertCircle, Euro, Calendar, ChevronRight, ChevronLeft,
  Loader2, Info, Shield, Percent, Banknote, TrendingUp, Star, Award
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    creditSystem: 'BidBlitz Guthaben-Kredit',
    applyForCredit: 'Guthaben beantragen',
    creditAmount: 'Kreditbetrag',
    repaymentMonths: 'Rückzahlung (Monate)',
    interestRate: 'Zinssatz',
    monthlyPayment: 'Monatliche Rate',
    totalRepayment: 'Gesamtrückzahlung',
    creditPurpose: 'Verwendungszweck (optional)',
    idFront: 'Ausweis Vorderseite',
    idBack: 'Ausweis Rückseite',
    selfieWithId: 'Selfie mit Ausweis',
    incomeProof: 'Einkommensnachweis',
    month1: 'Monat 1',
    month2: 'Monat 2',
    month3: 'Monat 3',
    uploadDocuments: 'Dokumente hochladen',
    submitApplication: 'Antrag einreichen',
    creditStatus: 'Kreditstatus',
    pending: 'In Prüfung',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt',
    active: 'Aktiv',
    repaid: 'Zurückgezahlt',
    remainingAmount: 'Restbetrag',
    makePayment: 'Zahlung leisten',
    myCredits: 'Meine Kredite',
    noCredits: 'Noch keine Kredite',
    creditEligibility: 'Kreditberechtigung',
    eligible: 'Berechtigt',
    notEligible: 'Nicht berechtigt',
    verificationRequired: 'Verifizierung erforderlich',
    activeCreditExists: 'Aktiver Kredit vorhanden - bitte zuerst zurückzahlen',
    pendingApplication: 'Antrag in Bearbeitung',
    // Credit Score translations
    creditScore: 'Kredit-Score',
    yourScore: 'Ihr Score',
    currentTier: 'Aktuelle Stufe',
    nextTier: 'Nächste Stufe',
    pointsNeeded: 'Punkte benötigt',
    maxCredit: 'Max. Kredit',
    yourInterestRate: 'Ihr Zinssatz',
    scoreHistory: 'Score-Verlauf',
    tipsToImprove: 'Tipps zur Verbesserung',
    creditsCompleted: 'Abgeschlossene Kredite',
    onTimePayments: 'Pünktliche Zahlungen',
    latePayments: 'Verspätete Zahlungen',
    scoreTooLow: 'Ihr Score ist zu niedrig für einen Kredit',
    improveScore: 'Score verbessern',
    repayFirst: 'Bitte zuerst zurückzahlen',
    applicationSubmitted: 'Antrag eingereicht!',
    awaitingReview: 'Wartet auf Prüfung',
    noInterestUnder50: 'Keine Zinsen unter €50',
    creditDisclaimer: 'Kein echtes Geld - nur BidBlitz Pay Guthaben',
    flexibleRepayment: 'Flexible Rückzahlung 3-6 Monate',
    creditTerms: 'Kreditbedingungen',
    iAccept: 'Ich akzeptiere die',
    terms: 'AGB',
    minAmount: 'Min',
    maxAmount: 'Max',
    interestRange: 'Zinsen',
    perMonth: 'pro Monat',
    step1Title: 'Betrag wählen',
    step2Title: 'Dokumente hochladen',
    step3Title: 'Bestätigen',
    requiredDocuments: 'Erforderliche Dokumente',
    selectFile: 'Datei auswählen',
    fileSelected: 'Datei ausgewählt',
    submitting: 'Wird eingereicht...',
    paymentAmount: 'Zahlungsbetrag',
    pay: 'Bezahlen',
    fullyRepaid: 'Vollständig zurückgezahlt!',
    paymentSuccessful: 'Zahlung erfolgreich',
    nextPaymentDue: 'Nächste Zahlung fällig',
    creditHistory: 'Kreditverlauf',
    viewDetails: 'Details anzeigen',
    back: 'Zurück',
    creditId: 'Kredit-ID',
    appliedOn: 'Beantragt am',
    approvedOn: 'Genehmigt am',
    totalPaid: 'Bereits gezahlt',
    payments: 'Zahlungen',
    noPaymentsYet: 'Noch keine Zahlungen',
    checkEligibility: 'Berechtigung prüfen',
    startApplication: 'Jetzt beantragen',
    yourDocuments: 'Ihre Dokumente',
    allDocumentsRequired: 'Alle Dokumente sind erforderlich',
    holdIdVisible: 'Halten Sie den Ausweis gut sichtbar',
    clear3MonthStatements: 'Klare Kontoauszüge der letzten 3 Monate',
    of: 'von',
    points: 'Punkte',
    progressTo: 'Fortschritt zu',
    yourBenefits: 'Ihre Vorteile',
    allTiers: 'Alle Stufen',
    tierRed: 'Rot',
    tierYellow: 'Gelb',
    tierGreen: 'Grün',
    tierGold: 'Gold',
    tierDiamond: 'Diamant',
    tier: 'Stufe'
  },
  en: {
    creditSystem: 'Credit System',
    applyForCredit: 'Apply for Credit',
    creditAmount: 'Credit Amount',
    repaymentMonths: 'Repayment (Months)',
    interestRate: 'Interest Rate',
    monthlyPayment: 'Monthly Payment',
    totalRepayment: 'Total Repayment',
    creditPurpose: 'Purpose (optional)',
    idFront: 'ID Front',
    idBack: 'ID Back',
    selfieWithId: 'Selfie with ID',
    incomeProof: 'Income Proof',
    month1: 'Month 1',
    month2: 'Month 2',
    month3: 'Month 3',
    uploadDocuments: 'Upload Documents',
    submitApplication: 'Submit Application',
    creditStatus: 'Credit Status',
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    active: 'Active',
    repaid: 'Repaid',
    remainingAmount: 'Remaining Amount',
    makePayment: 'Make Payment',
    myCredits: 'My Credits',
    noCredits: 'No credits yet',
    creditEligibility: 'Credit Eligibility',
    eligible: 'Eligible',
    notEligible: 'Not Eligible',
    verificationRequired: 'Verification required',
    openCreditExists: 'Open credit exists',
    repayFirst: 'Please repay first',
    applicationSubmitted: 'Application submitted!',
    awaitingReview: 'Awaiting review',
    noInterestUnder50: 'No interest under €50',
    flexibleRepayment: 'Flexible repayment 3-6 months',
    creditTerms: 'Credit Terms',
    iAccept: 'I accept the',
    terms: 'terms',
    minAmount: 'Min',
    maxAmount: 'Max',
    interestRange: 'Interest',
    perMonth: 'per month',
    step1Title: 'Choose Amount',
    step2Title: 'Upload Documents',
    step3Title: 'Confirm',
    requiredDocuments: 'Required Documents',
    selectFile: 'Select file',
    fileSelected: 'File selected',
    submitting: 'Submitting...',
    paymentAmount: 'Payment Amount',
    pay: 'Pay',
    fullyRepaid: 'Fully repaid!',
    paymentSuccessful: 'Payment successful',
    nextPaymentDue: 'Next payment due',
    creditHistory: 'Credit History',
    viewDetails: 'View Details',
    back: 'Back',
    creditId: 'Credit ID',
    appliedOn: 'Applied on',
    approvedOn: 'Approved on',
    totalPaid: 'Total paid',
    payments: 'Payments',
    noPaymentsYet: 'No payments yet',
    checkEligibility: 'Check Eligibility',
    startApplication: 'Apply Now',
    yourDocuments: 'Your Documents',
    allDocumentsRequired: 'All documents are required',
    holdIdVisible: 'Hold ID clearly visible',
    clear3MonthStatements: 'Clear bank statements from last 3 months',
    of: 'of',
    points: 'Points',
    progressTo: 'Progress to',
    yourBenefits: 'Your Benefits',
    allTiers: 'All Tiers',
    tierRed: 'Red',
    tierYellow: 'Yellow',
    tierGreen: 'Green',
    tierGold: 'Gold',
    tierDiamond: 'Diamond',
    tier: 'Tier'
  },
  tr: {
    creditSystem: 'Kredi Sistemi', applyForCredit: 'Kredi Başvurusu',
    creditAmount: 'Kredi Tutarı', repaymentMonths: 'Geri Ödeme (Ay)',
    interestRate: 'Faiz Oranı', monthlyPayment: 'Aylık Ödeme',
    pending: 'İnceleniyor', approved: 'Onaylandı', rejected: 'Reddedildi',
    active: 'Aktif', repaid: 'Ödendi', myCredits: 'Kredilerim',
    idFront: 'Kimlik Önü', idBack: 'Kimlik Arkası', selfieWithId: 'Kimlikli Selfie',
    incomeProof: 'Gelir Belgesi', submitApplication: 'Başvuru Gönder', back: 'Geri'
  },
  ar: {
    creditSystem: 'نظام الائتمان', applyForCredit: 'تقديم طلب قرض',
    creditAmount: 'مبلغ القرض', repaymentMonths: 'فترة السداد (أشهر)',
    pending: 'قيد المراجعة', approved: 'موافق عليه', rejected: 'مرفوض',
    active: 'نشط', repaid: 'مسدد', myCredits: 'قروضي', back: 'رجوع'
  },
  el: {
    creditSystem: 'Σύστημα Πίστωσης', applyForCredit: 'Αίτηση Δανείου',
    creditAmount: 'Ποσό Δανείου', repaymentMonths: 'Αποπληρωμή (Μήνες)',
    pending: 'Σε Εξέταση', approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε',
    active: 'Ενεργό', repaid: 'Αποπληρώθηκε', myCredits: 'Τα Δάνειά μου', back: 'Πίσω'
  },
  fr: {
    creditSystem: 'Système de Crédit', applyForCredit: 'Demander un Crédit',
    creditAmount: 'Montant du Crédit', pending: 'En Attente', approved: 'Approuvé',
    rejected: 'Refusé', active: 'Actif', repaid: 'Remboursé', myCredits: 'Mes Crédits', back: 'Retour'
  },
  it: {
    creditSystem: 'Sistema di Credito', applyForCredit: 'Richiedi Credito',
    creditAmount: 'Importo del Credito', pending: 'In Revisione', approved: 'Approvato',
    rejected: 'Rifiutato', active: 'Attivo', repaid: 'Rimborsato', myCredits: 'I Miei Crediti', back: 'Indietro'
  },
  pt: {
    creditSystem: 'Sistema de Crédito', applyForCredit: 'Solicitar Crédito',
    creditAmount: 'Valor do Crédito', pending: 'Em Análise', approved: 'Aprovado',
    rejected: 'Rejeitado', active: 'Ativo', repaid: 'Pago', myCredits: 'Meus Créditos', back: 'Voltar'
  },
  ru: {
    creditSystem: 'Кредитная Система', applyForCredit: 'Подать заявку на кредит',
    creditAmount: 'Сумма кредита', pending: 'На рассмотрении', approved: 'Одобрено',
    rejected: 'Отклонено', active: 'Активный', repaid: 'Погашен', myCredits: 'Мои кредиты', back: 'Назад'
  },
  zh: {
    creditSystem: '信用系统', applyForCredit: '申请贷款',
    creditAmount: '贷款金额', pending: '审核中', approved: '已批准',
    rejected: '已拒绝', active: '进行中', repaid: '已还清', myCredits: '我的贷款', back: '返回'
  },
  sq: {
    creditSystem: 'Sistemi i Kredisë',
    applyForCredit: 'Apliko për Kredi',
    creditAmount: 'Shuma e Kredisë',
    repaymentMonths: 'Kthimi (Muaj)',
    interestRate: 'Norma e Interesit',
    monthlyPayment: 'Pagesa Mujore',
    totalRepayment: 'Kthimi Total',
    creditPurpose: 'Qëllimi (opsional)',
    idFront: 'Dokumenti Përpara',
    idBack: 'Dokumenti Pas',
    selfieWithId: 'Selfie me Dokument',
    incomeProof: 'Vërtetimi i të Ardhurave',
    month1: 'Muaji 1',
    month2: 'Muaji 2',
    month3: 'Muaji 3',
    uploadDocuments: 'Ngarko Dokumentet',
    submitApplication: 'Dorëzo Aplikimin',
    creditStatus: 'Statusi i Kredisë',
    pending: 'Në Shqyrtim',
    approved: 'Aprovuar',
    rejected: 'Refuzuar',
    active: 'Aktiv',
    repaid: 'I Paguar',
    remainingAmount: 'Shuma e Mbetur',
    makePayment: 'Bëj Pagesën',
    myCredits: 'Kreditë e Mia',
    noCredits: 'Asnjë kredi ende',
    creditEligibility: 'Përshtatshmëria për Kredi',
    eligible: 'I Përshtatshëm',
    notEligible: 'Nuk është i përshtatshëm',
    verificationRequired: 'Verifikimi kërkohet',
    activeCreditExists: 'Kredi aktive ekziston - ju lutem paguani së pari',
    pendingApplication: 'Aplikimi në pritje',
    creditScore: 'Vlerësimi i Kredisë',
    yourScore: 'Vlerësimi Juaj',
    currentTier: 'Niveli Aktual',
    nextTier: 'Niveli Tjetër',
    pointsNeeded: 'Pikët e nevojshme',
    maxCredit: 'Kredi Max.',
    yourInterestRate: 'Norma Juaj e Interesit',
    scoreHistory: 'Historia e Vlerësimit',
    tipsToImprove: 'Këshilla për Përmirësim',
    creditsCompleted: 'Kreditë e Përfunduara',
    onTimePayments: 'Pagesat në Kohë',
    latePayments: 'Pagesat e Vonuara',
    scoreTooLow: 'Vlerësimi juaj është shumë i ulët',
    improveScore: 'Përmirëso Vlerësimin',
    repayFirst: 'Ju lutem paguani së pari',
    applicationSubmitted: 'Aplikimi u dorëzua!',
    awaitingReview: 'Duke pritur shqyrtimin',
    noInterestUnder50: 'Pa interes nën €50',
    creditDisclaimer: 'Jo para të vërteta - vetëm BidBlitz Pay',
    flexibleRepayment: 'Kthim fleksibël 3-6 muaj',
    creditTerms: 'Kushtet e Kredisë',
    iAccept: 'Pranoj',
    terms: 'kushtet',
    minAmount: 'Min',
    maxAmount: 'Max',
    interestRange: 'Interesi',
    perMonth: 'për muaj',
    step1Title: 'Zgjidh Shumën',
    step2Title: 'Ngarko Dokumentet',
    step3Title: 'Konfirmo',
    requiredDocuments: 'Dokumentet e Nevojshme',
    selectFile: 'Zgjidh skedarin',
    fileSelected: 'Skedari u zgjodh',
    submitting: 'Duke dorëzuar...',
    paymentAmount: 'Shuma e Pagesës',
    pay: 'Paguaj',
    fullyRepaid: 'Paguar plotësisht!',
    paymentSuccessful: 'Pagesa e suksesshme',
    nextPaymentDue: 'Pagesa tjetër',
    creditHistory: 'Historia e Kredisë',
    viewDetails: 'Shiko Detajet',
    back: 'Kthehu',
    creditId: 'ID e Kredisë',
    appliedOn: 'Aplikuar më',
    approvedOn: 'Aprovuar më',
    totalPaid: 'Totali i paguar',
    payments: 'Pagesat',
    noPaymentsYet: 'Asnjë pagesë ende',
    checkEligibility: 'Kontrollo Përshtatshmërinë',
    startApplication: 'Apliko Tani',
    yourDocuments: 'Dokumentet Tuaja',
    allDocumentsRequired: 'Të gjitha dokumentet nevojiten',
    holdIdVisible: 'Mbaj dokumentin qartë të dukshëm',
    clear3MonthStatements: 'Pasqyra bankare të 3 muajve të fundit',
    of: 'nga',
    points: 'Pikë',
    progressTo: 'Progresi drejt',
    yourBenefits: 'Përfitimet Tuaja',
    allTiers: 'Të Gjitha Nivelet',
    tierRed: 'E Kuqe',
    tierYellow: 'E Verdhë',
    tierGreen: 'Jeshile',
    tierGold: 'Artë',
    tierDiamond: 'Diamant',
    tier: 'Niveli'
  }
};

const CreditSystem = ({ language = 'de', walletBalance = 0, onBalanceUpdate }) => {
  const [view, setView] = useState('main'); // main, apply, details, payment, score
  const [step, setStep] = useState(1);
  const [eligibility, setEligibility] = useState(null);
  const [credits, setCredits] = useState([]);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  
  // Application form state
  const [amount, setAmount] = useState(100);
  const [months, setMonths] = useState(3);
  const [purpose, setPurpose] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Document uploads
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfieWithId, setSelfieWithId] = useState(null);
  const [incomeProof1, setIncomeProof1] = useState(null);
  const [incomeProof2, setIncomeProof2] = useState(null);
  const [incomeProof3, setIncomeProof3] = useState(null);
  
  // Payment state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paying, setPaying] = useState(false);
  
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('bidblitz_token');
  
  const t = (key) => translations[language]?.[key] || translations.de[key] || translations.en[key] || key;
  
  // Fetch eligibility, credits and score
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const [eligRes, creditsRes, scoreRes] = await Promise.all([
        fetch(`${API}/api/credit/eligibility`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/credit/my-credits`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/credit/score`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (eligRes.ok) {
        const data = await eligRes.json();
        setEligibility(data);
      }
      
      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setCredits(data.credits || []);
      }
      
      if (scoreRes.ok) {
        const data = await scoreRes.json();
        setScoreData(data);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Calculate estimated payments based on tier interest rate
  const tierInterestRate = eligibility?.interest_rate || 3;
  const estimatedInterest = amount < 50 ? 0 : (amount * (tierInterestRate / 100) * months);
  const estimatedTotal = amount + estimatedInterest;
  const estimatedMonthly = estimatedTotal / months;
  
  // Submit application
  const handleSubmit = async () => {
    if (!idFront || !idBack || !selfieWithId || !incomeProof1 || !incomeProof2 || !incomeProof3) {
      toast.error('Bitte laden Sie alle erforderlichen Dokumente hoch');
      return;
    }
    
    if (!acceptTerms) {
      toast.error('Bitte akzeptieren Sie die Kreditbedingungen');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('repayment_months', months);
      formData.append('purpose', purpose);
      formData.append('id_front', idFront);
      formData.append('id_back', idBack);
      formData.append('selfie_with_id', selfieWithId);
      formData.append('income_proof_1', incomeProof1);
      formData.append('income_proof_2', incomeProof2);
      formData.append('income_proof_3', incomeProof3);
      
      const res = await fetch(`${API}/api/credit/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        toast.success(t('applicationSubmitted'));
        setView('main');
        setStep(1);
        resetForm();
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler beim Einreichen');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Fehler beim Einreichen');
    } finally {
      setSubmitting(false);
    }
  };
  
  const resetForm = () => {
    setAmount(100);
    setMonths(3);
    setPurpose('');
    setAcceptTerms(false);
    setIdFront(null);
    setIdBack(null);
    setSelfieWithId(null);
    setIncomeProof1(null);
    setIncomeProof2(null);
    setIncomeProof3(null);
  };
  
  // Make payment
  const handlePayment = async () => {
    const payAmount = parseFloat(paymentAmount);
    if (!payAmount || payAmount <= 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }
    
    if (payAmount > walletBalance) {
      toast.error('Nicht genügend Guthaben');
      return;
    }
    
    setPaying(true);
    
    try {
      const res = await fetch(`${API}/api/credit/repay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credit_id: selectedCredit.id,
          amount: payAmount
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.is_fully_repaid) {
          toast.success(t('fullyRepaid'));
        } else {
          toast.success(t('paymentSuccessful'));
        }
        setPaymentAmount('');
        fetchData();
        if (onBalanceUpdate) onBalanceUpdate();
        
        // Update selected credit
        const updatedCredit = await fetch(`${API}/api/credit/my-credits/${selectedCredit.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());
        setSelectedCredit(updatedCredit);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler bei der Zahlung');
      }
    } catch (error) {
      console.error('Error making payment:', error);
      toast.error('Fehler bei der Zahlung');
    } finally {
      setPaying(false);
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'repaid': return 'bg-gray-100 text-gray-600';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'active': return <Banknote className="w-4 h-4" />;
      case 'repaid': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // File upload component
  const FileUpload = ({ label, file, setFile, icon: Icon }) => (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${file ? 'bg-green-100' : 'bg-gray-100'}`}>
          {file ? <CheckCircle className="w-6 h-6 text-green-600" /> : <Icon className="w-6 h-6 text-gray-400" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-500">
            {file ? file.name : t('selectFile')}
          </p>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
          />
          <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
            file ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {file ? '✓' : 'Upload'}
          </span>
        </label>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }
  
  // Credit Score Detail View
  if (view === 'score' && scoreData) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView('main')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back')}
        </button>
        
        {/* Score Header */}
        <div 
          className="rounded-2xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${scoreData.tier.color}, ${scoreData.tier.color}dd)` }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-4xl">{scoreData.tier.icon}</span>
            <div className="text-right">
              <p className="text-5xl font-bold">{scoreData.score}</p>
              <p className="text-white/70 text-sm">von 1000 Punkten</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-1">{scoreData.tier.name}</h2>
          <p className="text-white/80">Stufe {scoreData.tier.name_en}</p>
          
          {/* Progress to next tier */}
          {scoreData.next_tier && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex justify-between text-sm mb-2">
                <span>Fortschritt zu {scoreData.next_tier.icon} {scoreData.next_tier.name}</span>
                <span>{scoreData.next_tier.points_needed} Punkte</span>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full"
                  style={{ width: `${scoreData.progress_percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Tier Benefits */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          <div className="p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-500" />
              Ihre Vorteile
            </h3>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('maxCredit')}</span>
            <span className="font-medium">€{scoreData.tier.max_credit}</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('yourInterestRate')}</span>
            <span className="font-medium text-green-600">{scoreData.tier.interest_rate}%</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-800">{scoreData.stats.total_credits_completed}</p>
            <p className="text-xs text-green-600">{t('creditsCompleted')}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-800">{scoreData.stats.total_on_time_payments}</p>
            <p className="text-xs text-blue-600">{t('onTimePayments')}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-800">{scoreData.stats.total_late_payments}</p>
            <p className="text-xs text-red-600">{t('latePayments')}</p>
          </div>
        </div>
        
        {/* Tips */}
        {scoreData.tips && scoreData.tips.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                {t('tipsToImprove')}
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {scoreData.tips.map((tip, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tip.title}</p>
                    <p className="text-sm text-gray-500">{tip.description}</p>
                  </div>
                  <span className="text-green-600 font-bold">+{tip.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Score History */}
        {scoreData.history && scoreData.history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                {t('scoreHistory')}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {scoreData.history.slice().reverse().map((entry, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                  </div>
                  <span className={`font-bold ${entry.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.change >= 0 ? '+' : ''}{entry.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* All Tiers Overview */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold flex items-center gap-2">
              <Star className="w-5 h-5 text-orange-500" />
              Alle Stufen
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { icon: '🔴', name: 'Rot', score: '0-300', credit: '€0', interest: '5%', current: scoreData.tier.key === 'red' },
              { icon: '🟡', name: 'Gelb', score: '301-500', credit: '€500', interest: '5%', current: scoreData.tier.key === 'yellow' },
              { icon: '🟢', name: 'Grün', score: '501-700', credit: '€1.500', interest: '3%', current: scoreData.tier.key === 'green' },
              { icon: '⭐', name: 'Gold', score: '701-900', credit: '€2.000', interest: '2%', current: scoreData.tier.key === 'gold' },
              { icon: '💎', name: 'Diamant', score: '901+', credit: '€2.000', interest: '1.5%', current: scoreData.tier.key === 'diamond' },
            ].map((tier, idx) => (
              <div key={idx} className={`p-3 flex items-center justify-between ${tier.current ? 'bg-orange-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{tier.icon}</span>
                  <div>
                    <p className={`font-medium ${tier.current ? 'text-orange-600' : ''}`}>{tier.name}</p>
                    <p className="text-xs text-gray-400">{tier.score} Punkte</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p>{tier.credit}</p>
                  <p className="text-green-600">{tier.interest}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Credit Details View
  if (view === 'details' && selectedCredit) {
    const totalDue = selectedCredit.total_repayment || (selectedCredit.amount + (selectedCredit.total_interest || 0));
    const remaining = Math.max(0, totalDue - (selectedCredit.amount_repaid || 0));
    
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setView('main'); setSelectedCredit(null); }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back')}
        </button>
        
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium bg-white/20`}>
              {t(selectedCredit.status)}
            </span>
            <span className="text-sm opacity-80">#{selectedCredit.id.slice(0, 8)}</span>
          </div>
          
          <div className="text-4xl font-bold mb-2">€{selectedCredit.amount.toFixed(2)}</div>
          <p className="text-white/80">{t('creditAmount')}</p>
          
          {selectedCredit.status === 'active' && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex justify-between">
                <span>{t('remainingAmount')}</span>
                <span className="font-bold">€{Math.max(0, remaining).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('interestRate')}</span>
            <span className="font-medium">{selectedCredit.interest_rate || 0}%</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('monthlyPayment')}</span>
            <span className="font-medium">€{(selectedCredit.monthly_payment || 0).toFixed(2)}</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('totalRepayment')}</span>
            <span className="font-medium">€{(selectedCredit.total_repayment || selectedCredit.amount).toFixed(2)}</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('totalPaid')}</span>
            <span className="font-medium text-green-600">€{(selectedCredit.amount_repaid || 0).toFixed(2)}</span>
          </div>
          <div className="p-4 flex justify-between">
            <span className="text-gray-600">{t('appliedOn')}</span>
            <span className="font-medium">{formatDate(selectedCredit.created_at)}</span>
          </div>
          {selectedCredit.next_payment_date && (
            <div className="p-4 flex justify-between">
              <span className="text-gray-600">{t('nextPaymentDue')}</span>
              <span className="font-medium">{formatDate(selectedCredit.next_payment_date)}</span>
            </div>
          )}
        </div>
        
        {/* Payment Section for Active Credits */}
        {selectedCredit.status === 'active' && remaining > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Euro className="w-5 h-5 text-orange-500" />
              {t('makePayment')}
            </h3>
            
            <div className="flex gap-2">
              {[50, 100, remaining].filter(v => v > 0).map((val) => {
                const displayVal = Math.min(val, remaining);
                const isSelected = parseFloat(paymentAmount) === displayVal;
                return (
                  <button
                    key={val}
                    onClick={() => setPaymentAmount(displayVal.toFixed(2))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    €{displayVal.toFixed(0)}
                  </button>
                );
              })}
            </div>
            
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={t('paymentAmount')}
              min="1"
              max={remaining}
              step="0.01"
            />
            
            <Button
              onClick={handlePayment}
              disabled={paying || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
            >
              {paying ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Euro className="w-5 h-5 mr-2" />}
              {t('pay')} €{parseFloat(paymentAmount || 0).toFixed(2)}
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              Wallet Balance: €{walletBalance.toFixed(2)}
            </p>
          </div>
        )}
        
        {/* Payment History */}
        {selectedCredit.payments && selectedCredit.payments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">{t('payments')}</h3>
            <div className="space-y-2">
              {selectedCredit.payments.map((payment, idx) => (
                <div key={idx} className="flex justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600">{formatDate(payment.date)}</span>
                  <span className="font-medium text-green-600">€{payment.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Application Flow
  if (view === 'apply') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setView('main'); setStep(1); }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('back')}
        </button>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-1 ${step > s ? 'bg-orange-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        
        {/* Step 1: Amount Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-center">{t('step1Title')}</h2>
            
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">€{amount}</div>
                <p className="opacity-80">{t('creditAmount')}</p>
              </div>
              
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value))}
                className="w-full mt-6 accent-white"
              />
              
              <div className="flex justify-between text-sm mt-2 opacity-80">
                <span>€50</span>
                <span>€2.000</span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('repaymentMonths')}
              </label>
              <div className="flex gap-2">
                {[3, 4, 5, 6].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      months === m
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {m} Mon
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('interestRate')}</span>
                <span className="font-medium">{amount < 50 ? '0%' : '2-5%'} {t('perMonth')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('monthlyPayment')}</span>
                <span className="font-medium">~€{estimatedMonthly.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-100 pt-2">
                <span className="text-gray-600">{t('totalRepayment')}</span>
                <span className="font-bold text-lg">~€{estimatedTotal.toFixed(2)}</span>
              </div>
              {amount < 50 && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  {t('noInterestUnder50')}
                </div>
              )}
            </div>
            
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t('creditPurpose')}
            />
            
            <Button
              onClick={() => setStep(2)}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
            >
              {t('uploadDocuments')}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
        
        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">{t('step2Title')}</h2>
            
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <h3 className="font-medium text-blue-900 mb-2">{t('requiredDocuments')}</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• {t('holdIdVisible')}</li>
                <li>• {t('clear3MonthStatements')}</li>
              </ul>
            </div>
            
            <FileUpload
              label={t('idFront')}
              file={idFront}
              setFile={setIdFront}
              icon={CreditCard}
            />
            
            <FileUpload
              label={t('idBack')}
              file={idBack}
              setFile={setIdBack}
              icon={CreditCard}
            />
            
            <FileUpload
              label={t('selfieWithId')}
              file={selfieWithId}
              setFile={setSelfieWithId}
              icon={Camera}
            />
            
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="font-medium mb-3">{t('incomeProof')} (3 {t('repaymentMonths')})</h3>
              
              <div className="space-y-3">
                <FileUpload
                  label={`${t('month1')}`}
                  file={incomeProof1}
                  setFile={setIncomeProof1}
                  icon={FileText}
                />
                <FileUpload
                  label={`${t('month2')}`}
                  file={incomeProof2}
                  setFile={setIncomeProof2}
                  icon={FileText}
                />
                <FileUpload
                  label={`${t('month3')}`}
                  file={incomeProof3}
                  setFile={setIncomeProof3}
                  icon={FileText}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                {t('back')}
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!idFront || !idBack || !selfieWithId || !incomeProof1 || !incomeProof2 || !incomeProof3}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600"
              >
                {t('step3Title')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">{t('step3Title')}</h2>
            
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/70 text-sm">{t('creditAmount')}</p>
                  <p className="text-2xl font-bold">€{amount}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">{t('repaymentMonths')}</p>
                  <p className="text-2xl font-bold">{months} Mon</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 divide-y">
              <div className="p-4 flex justify-between">
                <span className="text-gray-600">{t('interestRange')}</span>
                <span className="font-medium">{amount < 50 ? '0%' : '2-5%'}</span>
              </div>
              <div className="p-4 flex justify-between">
                <span className="text-gray-600">{t('monthlyPayment')}</span>
                <span className="font-medium">~€{estimatedMonthly.toFixed(2)}</span>
              </div>
              <div className="p-4 flex justify-between">
                <span className="text-gray-600">{t('totalRepayment')}</span>
                <span className="font-bold">~€{estimatedTotal.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-xl p-4">
              <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {t('yourDocuments')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t('idFront')}</div>
                <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t('idBack')}</div>
                <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t('selfieWithId')}</div>
                <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 3x {t('incomeProof')}</div>
              </div>
            </div>
            
            <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">
                {t('iAccept')} <a href="/agb" className="text-orange-500 underline">{t('creditTerms')}</a>
              </span>
            </label>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                {t('back')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!acceptTerms || submitting}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                {submitting ? t('submitting') : t('submitApplication')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Main View
  return (
    <div className="space-y-4">
      {/* Credit Score Card */}
      {scoreData && (
        <div 
          className="rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
          style={{ 
            background: `linear-gradient(135deg, ${scoreData.tier.color}20, ${scoreData.tier.color}10)`,
            borderColor: scoreData.tier.color,
            borderWidth: '1px'
          }}
          onClick={() => setView('score')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{scoreData.tier.icon}</span>
              <div>
                <p className="font-bold text-lg">{t('creditScore')}</p>
                <p className="text-sm opacity-70">{scoreData.tier.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: scoreData.tier.color }}>{scoreData.score}</p>
              <p className="text-xs opacity-70">von 1000</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-white/50 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(scoreData.score / 1000) * 100}%`,
                backgroundColor: scoreData.tier.color 
              }}
            />
          </div>
          
          <div className="flex justify-between text-xs">
            <span>Max. Kredit: €{scoreData.tier.max_credit}</span>
            <span>Zinsen: {scoreData.tier.interest_rate}%</span>
            {scoreData.next_tier && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {scoreData.next_tier.points_needed} bis {scoreData.next_tier.icon}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Eligibility Card */}
      {eligibility && (
        <div className={`rounded-xl p-4 ${eligibility.eligible ? 'bg-green-50 border border-green-200' : eligibility.blocking_reason === 'score_too_low' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            {eligibility.eligible ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : eligibility.blocking_reason === 'score_too_low' ? (
              <XCircle className="w-8 h-8 text-red-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {eligibility.eligible ? t('eligible') : t('notEligible')}
              </p>
              <p className="text-sm text-gray-600">
                {eligibility.blocking_reason === 'verification_required' && t('verificationRequired')}
                {eligibility.blocking_reason === 'active_credit_exists' && t('activeCreditExists')}
                {eligibility.blocking_reason === 'pending_application' && t('pendingApplication')}
                {eligibility.blocking_reason === 'score_too_low' && t('scoreTooLow')}
                {eligibility.eligible && `€${eligibility.min_amount} - €${eligibility.max_amount} • ${eligibility.interest_rate}% Zinsen`}
              </p>
            </div>
            {eligibility.eligible && (
              <Button
                onClick={() => setView('apply')}
                className="bg-gradient-to-r from-orange-500 to-amber-600"
              >
                {t('startApplication')}
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Disclaimer - BidBlitz Guthaben only */}
      <div className="bg-blue-50 rounded-xl p-3 text-center">
        <p className="text-sm text-blue-700 flex items-center justify-center gap-2">
          <Info className="w-4 h-4" />
          {t('creditDisclaimer')}
        </p>
      </div>
      
      {/* Features Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <Percent className="w-6 h-6 text-blue-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-blue-800">{eligibility?.interest_rate || '2-5'}%</p>
          <p className="text-xs text-blue-600">{t('yourInterestRate')}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <Euro className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800">€{eligibility?.max_amount || 2000}</p>
          <p className="text-xs text-green-600">{t('maxCredit')}</p>
        </div>
      </div>
      
      {/* My Credits */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            {t('myCredits')}
          </h3>
        </div>
        
        {credits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t('noCredits')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {credits.map((credit) => (
              <div
                key={credit.id}
                onClick={() => { setSelectedCredit(credit); setView('details'); }}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(credit.status)}`}>
                    {getStatusIcon(credit.status)}
                  </div>
                  <div>
                    <p className="font-medium">€{credit.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">{formatDate(credit.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(credit.status)}`}>
                    {t(credit.status)}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditSystem;
