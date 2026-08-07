import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const { width } = Dimensions.get('window');

// ── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F4F0',
  ink: '#0A0A0A',
  inkMid: '#3A3A3A',
  inkLight: '#7A7A7A',
  accent: '#0A0A0A',
  accentText: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceDark: '#111111',
  pill: '#E8E6E0',
  pillText: '#4A4A4A',
  border: '#E0DDD6',
  gold: '#C8A96E',
};

const F = {
  display: 'DMSerifDisplay_400Regular',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function Navbar() {
  const router = useRouter();
  return (
    <View style={s.navbar}>
      <View style={s.navBrand}>
        <View style={s.navLogo} />
        <Text style={s.navBrandText}>COLEARN</Text>
      </View>
      <TouchableOpacity style={s.navCta} activeOpacity={0.85} onPress={() => router.push('/login')}>
        <Text style={s.navCtaText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

function HeroSection() {
  const router = useRouter();
  const fadeY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeY, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.hero, { opacity, transform: [{ translateY: fadeY }] }]}>
      <View style={s.heroPill}>
        <Text style={s.heroPillText}>BUILT FOR ALL STUDENTS</Text>
      </View>
      <Text style={s.heroTitle}>Do more with Less on CoLearn.</Text>
      <Text style={s.heroBody}>
        The all-in-one platform for university students to master their courses. Access
        curriculum-aligned notes, past questions, and collaborative study spaces
        designed for academic precision.
      </Text>
      <TouchableOpacity style={s.heroCta} activeOpacity={0.85} onPress={() => router.push('/register')}>
        <Text style={s.heroCtaText}>Join CoLearn</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}



function CurriculumSection() {
  const exams = [
    'EXAMS', 'ENGINEERING', 'SCIENCES', 'MEDICINE', 'ARTS',
    'COMPUTING', 'BUSINESS', 'LAW', 'ENVIRONMENTAL', 'AGRICULTURE'
  ];
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const halfWidth = useRef(0);

  useEffect(() => {
    let lastTime = Date.now();
    let animId: any;
    
    const scrollMarquee = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      
      if (scrollRef.current && halfWidth.current > 0) {
        // Smooth frame-rate independent increment
        scrollX.current += 0.05 * delta; 
        if (scrollX.current >= halfWidth.current) {
          scrollX.current = scrollX.current - halfWidth.current;
        }
        scrollRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
      animId = requestAnimationFrame(scrollMarquee);
    };

    animId = requestAnimationFrame(scrollMarquee);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <View style={s.curriculum}>
      <Text style={s.sectionLabel}>MASTER YOUR CURRICULUM</Text>
      <ScrollView 
        ref={scrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.marqueeScroll}
        style={s.marqueeOuter}
        scrollEnabled={false}
        onContentSizeChange={(w) => {
          halfWidth.current = w / 2;
        }}
      >
        {[...exams, ...exams].map((e, i) => (
          <TouchableOpacity key={`${e}-${i}`} style={s.examChip} activeOpacity={0.7}>
            <Text style={[s.examChipText, (i % exams.length) === 0 && s.examChipTextLarge]}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  dark = false,
  cta,
}: {
  icon: string;
  title: string;
  body: string;
  dark?: boolean;
  cta?: string;
}) {
  return (
    <View style={[s.featureCard, dark && s.featureCardDark]}>
      <View style={[s.featureIcon, dark && s.featureIconDark]}>
        <Text style={s.featureIconText}>{icon}</Text>
      </View>
      <Text style={[s.featureTitle, dark && s.featureTitleDark]}>{title}</Text>
      <Text style={[s.featureBody, dark && s.featureBodyDark]}>{body}</Text>
      {cta && (
        <TouchableOpacity style={[s.featureCta, dark && s.featureCtaDark]} activeOpacity={0.85}>
          <Text style={[s.featureCtaText, dark && s.featureCtaTextDark]}>{cta}</Text>
        </TouchableOpacity>
      )}
      {title === 'Smart Notes' && (
        <View style={s.notesPreview}>
          {[70, 85, 60, 90, 50, 75].map((w, i) => (
            <View key={i} style={[s.notesLine, { width: `${w}%` }]} />
          ))}
        </View>
      )}
    </View>
  );
}

function DesignedSection() {
  return (
    <View style={s.designedCard}>
      <Text style={s.designedTitle}>Designed for{'\n'}Excellence</Text>
      <Text style={s.designedBody}>
        Our specialized toolkit is architected to streamline demanding university curricula,
        providing the clarity needed for top-tier academic results.
      </Text>
    </View>
  );
}

function PricingSection({ prices }: { prices: { standard: number; plus: number } }) {
  return (
    <LinearGradient colors={['#111111', '#0a0a0a']} style={s.pricing}>
      <Text style={s.pricingHeadline}>Ready to{'\n'}top your{'\n'}class?</Text>
      <Text style={s.pricingSubtitle}>
        Join CoLearn and get the tools you need to conquer your curriculum. Access premium
        features designed for your academic experience.
      </Text>

      <View style={s.pricingCard}>
        <Text style={s.pricingCardLabel}>SINGLE SEMESTER</Text>
        <Text style={s.pricingCardAmount}>{prices.standard.toLocaleString()} NGN</Text>
      </View>

      <View style={[s.pricingCard, s.pricingCardFeatured]}>
        <View style={s.bestValueBadge}>
          <Text style={s.bestValueText}>BEST VALUE</Text>
        </View>
        <Text style={s.pricingCardLabel}>TWO SEMESTERS</Text>
        <Text style={[s.pricingCardAmount, s.pricingCardAmountFeatured]}>{prices.plus.toLocaleString()} NGN</Text>
      </View>
    </LinearGradient>
  );
}

function Footer() {
  const router = useRouter();
  const links = [
    { label: 'Privacy policy', route: '/privacy' },
    { label: 'Terms and Conditions', route: '/terms' }
  ];
  return (
    <View style={s.footer}>
      <Text style={s.footerBrand}>COLEARN</Text>
      <View style={s.footerLinks}>
        {links.map((link) => (
          <TouchableOpacity 
            key={link.label} 
            activeOpacity={0.7}
            onPress={() => router.push(link.route as any)}
          >
            <Text style={s.footerLink}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.footerCopy}>© 2026 Pillara Education 2026</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function LandingScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [prices, setPrices] = useState({ standard: 3000, plus: 5000 });

  useEffect(() => {
    if (!loading && user) {
      if (profile?.isBanned) {
        router.replace('/banned' as any);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, profile, loading]);

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const std = typeof data.standardPrice === 'number' ? data.standardPrice : (parseInt(data.standardPrice) || 3000);
          const pls = typeof data.plusPrice === 'number' ? data.plusPrice : (parseInt(data.plusPrice) || 5000);
          setPrices({ standard: std, plus: pls });
        }
      }, (err) => {
        console.warn('Failed to listen to dynamic prices from Firebase:', err);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Failed setting up price listener:', err);
    }
  }, []);

  if (loading) return null;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Navbar />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection />
        <CurriculumSection />

        <FeatureCard
          icon="📝"
          title="Smart Notes"
          body="Organize your lecture materials with our structural engine. Create, tag, and search your academic universe with surgical precision."
        />

        <FeatureCard
          icon="🎯"
          title="Exam Prep"
          body="Access a massive repository of past examination questions and detailed answers curated for your department."
          dark
        />

        <PricingSection prices={prices} />
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: C.ink,
  },
  navBrandText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: C.ink,
    letterSpacing: 2,
  },
  navCta: {
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navCtaText: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.accentText,
  },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    backgroundColor: C.bg,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: C.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroPillText: {
    fontFamily: F.medium,
    fontSize: 10,
    color: C.pillText,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontFamily: F.display,
    fontSize: 40,
    lineHeight: 46,
    color: C.ink,
    marginBottom: 16,
  },
  heroBody: {
    fontFamily: F.body,
    fontSize: 15,
    lineHeight: 23,
    color: C.inkMid,
    marginBottom: 28,
  },
  heroCta: {
    backgroundColor: C.ink,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  heroCtaText: {
    fontFamily: F.medium,
    fontSize: 15,
    color: C.accentText,
    letterSpacing: 0.3,
  },

  // Hero image
  heroImgWrap: {
    marginHorizontal: 24,
    marginBottom: 40,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroImg: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgWindowFrame: {
    width: 80,
    height: 120,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgWindowLight: {
    width: 40,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  imgOverlayText: {
    position: 'absolute',
    bottom: 16,
    right: 20,
  },
  imgOverlayLabel: {
    fontFamily: F.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Curriculum
  curriculum: {
    paddingHorizontal: 24,
    marginBottom: 36,
  },
  sectionLabel: {
    fontFamily: F.medium,
    fontSize: 10,
    color: C.inkLight,
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  marqueeOuter: {
    marginHorizontal: -24,
  },
  marqueeScroll: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  examGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  examChip: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  examChipText: {
    fontFamily: F.medium,
    fontSize: 20,
    color: C.inkLight,
    letterSpacing: 0.5,
  },
  examChipTextLarge: {
    color: C.ink,
    fontSize: 22,
  },

  // Feature cards
  featureCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureCardDark: {
    backgroundColor: C.surfaceDark,
    borderColor: '#2a2a2a',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconDark: {
    backgroundColor: '#2a2a2a',
  },
  featureIconText: {
    fontSize: 20,
  },
  featureTitle: {
    fontFamily: F.display,
    fontSize: 24,
    color: C.ink,
    marginBottom: 10,
  },
  featureTitleDark: {
    color: '#F5F4F0',
  },
  featureBody: {
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 21,
    color: C.inkMid,
  },
  featureBodyDark: {
    color: '#9A9A9A',
  },
  featureCta: {
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
  },
  featureCtaDark: {
    borderColor: '#FFFFFF',
  },
  featureCtaText: {
    fontFamily: F.medium,
    fontSize: 14,
    color: C.ink,
  },
  featureCtaTextDark: {
    color: '#FFFFFF',
  },
  notesPreview: {
    marginTop: 20,
    gap: 8,
  },
  notesLine: {
    height: 6,
    backgroundColor: C.border,
    borderRadius: 3,
  },

  // Designed section
  designedCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  designedTitle: {
    fontFamily: F.display,
    fontSize: 26,
    lineHeight: 32,
    color: C.ink,
    marginBottom: 12,
  },
  designedBody: {
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 22,
    color: C.inkMid,
  },

  // Pricing
  pricing: {
    marginTop: 8,
    padding: 28,
    paddingTop: 48,
    paddingBottom: 48,
  },
  pricingHeadline: {
    fontFamily: F.display,
    fontSize: 42,
    lineHeight: 48,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pricingSubtitle: {
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 22,
    color: '#9A9A9A',
    marginBottom: 32,
  },
  pricingCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pricingCardFeatured: {
    borderColor: C.gold,
    marginBottom: 28,
  },
  pricingCardLabel: {
    fontFamily: F.medium,
    fontSize: 10,
    color: '#6A6A6A',
    letterSpacing: 2,
    marginBottom: 6,
  },
  pricingCardAmount: {
    fontFamily: F.display,
    fontSize: 32,
    color: '#FFFFFF',
  },
  pricingCardAmountFeatured: {
    color: C.gold,
  },
  bestValueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 12,
  },
  bestValueText: {
    fontFamily: F.bold,
    fontSize: 9,
    color: '#0A0A0A',
    letterSpacing: 1.5,
  },
  pricingCta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pricingCtaText: {
    fontFamily: F.medium,
    fontSize: 15,
    color: '#0A0A0A',
  },

  // Footer
  footer: {
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: 'center',
    gap: 12,
  },
  footerBrand: {
    fontFamily: F.bold,
    fontSize: 16,
    color: C.ink,
    letterSpacing: 3,
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.inkLight,
  },
  footerCopy: {
    fontFamily: F.body,
    fontSize: 11,
    color: C.inkLight,
    textAlign: 'center',
  },
});
