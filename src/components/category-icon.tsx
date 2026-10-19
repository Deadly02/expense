import {
  Apple, Baby, Banknote, Beer, BookOpen, Briefcase, Bus, Car, Circle, Coffee, CreditCard, Droplet, Dumbbell, Ellipsis,
  Film, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, Hotel, House, Landmark, Laptop, Music, PartyPopper, PawPrint,
  PiggyBank, Pill, Pizza, Plane, Receipt, Scissors, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sparkles, Stethoscope,
  Store, Ticket, TrainFront, TrendingUp, Undo2, Users, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icons a category can use. The key is what's stored in the database. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, pizza: Pizza, apple: Apple, beer: Beer,
  car: Car, bus: Bus, "train-front": TrainFront, plane: Plane, fuel: Fuel,
  "shopping-basket": ShoppingBasket, "shopping-bag": ShoppingBag, store: Store, shirt: Shirt, gift: Gift,
  receipt: Receipt, zap: Zap, droplet: Droplet, wifi: Wifi, smartphone: Smartphone,
  house: House, hotel: Hotel, wrench: Wrench, scissors: Scissors, sparkles: Sparkles,
  "heart-pulse": HeartPulse, pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell, baby: Baby,
  "party-popper": PartyPopper, film: Film, music: Music, "gamepad-2": Gamepad2, ticket: Ticket,
  "graduation-cap": GraduationCap, "book-open": BookOpen, "paw-print": PawPrint, users: Users, ellipsis: Ellipsis,
  briefcase: Briefcase, laptop: Laptop, "undo-2": Undo2, landmark: Landmark, "piggy-bank": PiggyBank,
  "trending-up": TrendingUp, wallet: Wallet, "credit-card": CreditCard, banknote: Banknote, circle: Circle,
};
export const ICON_KEYS = Object.keys(CATEGORY_ICONS);

/** Colours a category can use (readable on white and on dark backgrounds). */
export const CATEGORY_COLORS = [
  "#f97316", "#ef4444", "#ec4899", "#db2777", "#8b5cf6", "#6366f1",
  "#2563eb", "#0ea5e9", "#0891b2", "#14b8a6", "#22c55e", "#16a34a",
  "#eab308", "#a16207", "#64748b", "#475569",
];

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon: string;
  color: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Circle;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-4",
        size === "lg" && "size-11 [&_svg]:size-5",
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}
