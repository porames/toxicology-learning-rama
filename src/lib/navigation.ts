import { LayoutDashboard, BookOpen, ClipboardList, Wrench } from '@lucide/svelte';

export interface NavItem {
	labelKey: string;
	href: string;
	icon: typeof LayoutDashboard;
	visibleForAll?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
	{ labelKey: 'nav.classes', href: '/classes', icon: BookOpen },
	{ labelKey: 'nav.quizzes', href: '/quiz', icon: ClipboardList },
	{ labelKey: 'nav.settings', href: '/settings', icon: Wrench, visibleForAll: true },
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
	return NAV_ITEMS.filter((item) => {
		if (item.visibleForAll) return true;
		if (isAdmin) return true;
		return item.labelKey === 'nav.classes';
	});
}

export function isNavActive(pathname: string, href: string): boolean {
	if (href === '/quiz') return pathname.startsWith('/quiz');
	return pathname.startsWith(href);
}
