import { LayoutDashboard, BookOpen, Beaker, ClipboardList } from '@lucide/svelte';

export interface NavItem {
	label: string;
	href: string;
	icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
	{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
	{ label: 'Classes', href: '/classes', icon: BookOpen },
	//{ label: 'Simulator', href: '/simulator', icon: Beaker },
	{ label: 'Quizzes', href: '/quiz', icon: ClipboardList },
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
	return NAV_ITEMS.filter((item) => {
		if (isAdmin) return true;
		return item.label === 'Classes' || item.label === 'Simulator';
	});
}

export function isNavActive(pathname: string, href: string): boolean {
	if (href === '/quiz') return pathname.startsWith('/quiz');
	return pathname.startsWith(href);
}
