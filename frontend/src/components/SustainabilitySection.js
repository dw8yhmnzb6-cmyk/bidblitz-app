import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Leaf, Heart, Globe, TreePine, Users, Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SustainabilitySection = () => {
  const { language } = useLanguage();
  const [stats, setStats] = useState({
    trees_planted: 0,
    projects_supported: 0,
    co2_offset_kg: 0
  });
  
  useEffect(() => {
    // Fetch real stats from backend
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API}/api/sustainability/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching sustainability stats:', err);
      }
    };
    fetchStats();
  }, []);
  
  const t = {
    de: {
      title: 'Innovation mit Verantwortung',
      subtitle: 'BidBlitz – Weil Erfolg nur zählt, wenn er nachhaltig ist',
      description: 'Jede Transaktion trägt nicht nur zum wirtschaftlichen Erfolg bei, sondern leistet einen messbaren Beitrag zum Klimaschutz. Nachhaltigkeit ist für BidBlitz kein Trend – sondern ein Versprechen.',
      projectsTitle: 'Unsere Projekte',
      projectsDesc: 'Wir unterstützen lokale Initiativen und fördern nachhaltige Projekte in der Gemeinde.',
      donationsTitle: 'Spenden & Helfen',
      donationsDesc: 'Ein Teil jedes Gewinns geht an wohltätige Organisationen und soziale Einrichtungen.',
      climateTitle: 'Klimaschutz',
      climateDesc: 'CO₂-neutrale Auktionen durch Kompensation und umweltfreundliche Prozesse.',
      communityTitle: 'Community',
      communityDesc: 'Gemeinsam mit unseren Nutzern gestalten wir eine bessere Zukunft.',
      impactTitle: 'Unser Beitrag',
      treesPlanted: 'Bäume gepflanzt',
      projectsSupported: 'Projekte unterstützt',
      co2Saved: 'kg CO₂ kompensiert',
      cta: 'Mehr erfahren',
      quote: 'Gemeinsam für eine nachhaltige Zukunft',
    },
    en: {
      title: 'Innovation with Responsibility',
      subtitle: 'BidBlitz – Because success only counts when it\'s sustainable',
      description: 'Every transaction contributes not only to economic success, but also makes a measurable contribution to climate protection. For BidBlitz, sustainability is not a trend – it\'s a promise.',
      projectsTitle: 'Our Projects',
      projectsDesc: 'We support local initiatives and promote sustainable projects in the community.',
      donationsTitle: 'Donations & Help',
      donationsDesc: 'A portion of every profit goes to charitable organizations and social institutions.',
      climateTitle: 'Climate Protection',
      climateDesc: 'Carbon-neutral auctions through compensation and environmentally friendly processes.',
      communityTitle: 'Community',
      communityDesc: 'Together with our users, we shape a better future.',
      impactTitle: 'Our Impact',
      treesPlanted: 'Trees planted',
      projectsSupported: 'Projects supported',
      co2Saved: 'kg CO₂ offset',
      cta: 'Learn more',
      quote: 'Together for a sustainable future',
    },
    sq: {
      title: 'Inovacion me Përgjegjësi',
      subtitle: 'BidBlitz – Sepse suksesi vlen vetëm kur është i qëndrueshëm',
      description: 'Çdo transaksion kontribon jo vetëm në suksesin ekonomik, por gjithashtu bën një kontribut të matshëm në mbrojtjen e klimës.',
      projectsTitle: 'Projektet Tona',
      projectsDesc: 'Ne mbështesim iniciativat lokale dhe promovojmë projekte të qëndrueshme në komunitet.',
      donationsTitle: 'Donacione & Ndihmë',
      donationsDesc: 'Një pjesë e çdo fitimi shkon për organizatat bamirëse.',
      climateTitle: 'Mbrojtja e Klimës',
      climateDesc: 'Ankande neutrale ndaj karbonit përmes kompensimit dhe proceseve miqësore me mjedisin.',
      communityTitle: 'Komuniteti',
      communityDesc: 'Së bashku me përdoruesit tanë, ndërtojmë një të ardhme më të mirë.',
      impactTitle: 'Ndikimi Ynë',
      treesPlanted: 'Pemë të mbjella',
      projectsSupported: 'Projekte të mbështetura',
      co2Saved: 'kg CO₂ kompensuar',
      cta: 'Mëso më shumë',
      quote: 'Së bashku për një të ardhme të qëndrueshme',
    },
    tr: {
      title: 'Sorumlulukla İnovasyon',
      subtitle: 'BidBlitz – Başarı ancak sürdürülebilir olduğunda değerlidir',
      description: 'Her işlem yalnızca ekonomik başarıya değil, aynı zamanda iklim korumasına da ölçülebilir bir katkı sağlar.',
      projectsTitle: 'Projelerimiz',
      projectsDesc: 'Yerel girişimleri destekliyoruz ve toplulukta sürdürülebilir projeleri teşvik ediyoruz.',
      donationsTitle: 'Bağışlar & Yardım',
      donationsDesc: 'Her kârın bir kısmı hayır kurumlarına ve sosyal kurumlara gider.',
      climateTitle: 'İklim Koruma',
      climateDesc: 'Tazminat ve çevre dostu süreçlerle karbon nötr müzayedeler.',
      communityTitle: 'Topluluk',
      communityDesc: 'Kullanıcılarımızla birlikte daha iyi bir gelecek şekillendiriyoruz.',
      impactTitle: 'Etkimiz',
      treesPlanted: 'Dikilen ağaçlar',
      projectsSupported: 'Desteklenen projeler',
      co2Saved: 'kg CO₂ dengelendi',
      cta: 'Daha fazla bilgi',
      quote: 'Sürdürülebilir bir gelecek için birlikte',
    },
    fr: {
      title: 'Innovation avec Responsabilité',
      subtitle: 'BidBlitz – Car le succès ne compte que s\'il est durable',
      description: 'Chaque transaction contribue non seulement au succès économique, mais apporte également une contribution mesurable à la protection du climat.',
      projectsTitle: 'Nos Projets',
      projectsDesc: 'Nous soutenons les initiatives locales et promouvons des projets durables dans la communauté.',
      donationsTitle: 'Dons & Aide',
      donationsDesc: 'Une partie de chaque bénéfice va à des organisations caritatives.',
      climateTitle: 'Protection du Climat',
      climateDesc: 'Enchères neutres en carbone grâce à la compensation et aux processus respectueux de l\'environnement.',
      communityTitle: 'Communauté',
      communityDesc: 'Avec nos utilisateurs, nous façonnons un avenir meilleur.',
      impactTitle: 'Notre Impact',
      treesPlanted: 'Arbres plantés',
      projectsSupported: 'Projets soutenus',
      co2Saved: 'kg CO₂ compensé',
      cta: 'En savoir plus',
      quote: 'Ensemble pour un avenir durable',
    }
  };
  
  const text = t[language] || t.de;
  
  // Use real stats from backend
  const impactStats = {
    trees: stats.trees_planted || 0,
    projects: stats.projects_supported || 0,
    co2: stats.co2_offset_kg || 0
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 py-12 sm:py-16" data-testid="sustainability-section">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Leaf className="w-8 h-8 text-emerald-600" />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">{text.title}</h2>
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-emerald-700 font-medium text-lg mb-2">{text.subtitle}</p>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">{text.description}</p>
        </div>
        
        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Projects Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-emerald-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <TreePine className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{text.projectsTitle}</h3>
            <p className="text-gray-600 text-sm">{text.projectsDesc}</p>
          </div>
          
          {/* Donations Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-rose-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{text.donationsTitle}</h3>
            <p className="text-gray-600 text-sm">{text.donationsDesc}</p>
          </div>
          
          {/* Climate Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-teal-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-teal-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{text.climateTitle}</h3>
            <p className="text-gray-600 text-sm">{text.climateDesc}</p>
          </div>
          
          {/* Community Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-amber-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{text.communityTitle}</h3>
            <p className="text-gray-600 text-sm">{text.communityDesc}</p>
          </div>
        </div>
        
        {/* Impact Stats */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-emerald-200 shadow-xl mb-8">
          <h3 className="text-center font-bold text-gray-800 text-xl mb-6 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            {text.impactTitle}
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </h3>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {/* Trees */}
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 mb-1">
                {impactStats.trees.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 flex items-center justify-center gap-1">
                <TreePine className="w-4 h-4 text-emerald-500" />
                {text.treesPlanted}
              </div>
            </div>
            
            {/* Projects */}
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-rose-600 mb-1">
                {impactStats.projects}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 flex items-center justify-center gap-1">
                <Heart className="w-4 h-4 text-rose-500" />
                {text.projectsSupported}
              </div>
            </div>
            
            {/* CO2 */}
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-1">
                {impactStats.co2.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 flex items-center justify-center gap-1">
                <Globe className="w-4 h-4 text-teal-500" />
                {text.co2Saved}
              </div>
            </div>
          </div>
        </div>
        
        {/* Quote / CTA */}
        <div className="text-center">
          <p className="text-emerald-700 font-medium text-lg italic mb-4">"{text.quote}"</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Leaf className="w-4 h-4 text-emerald-500" />
            <span>BidBlitz – {text.title}</span>
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SustainabilitySection;
