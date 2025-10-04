// Types matching Bright Data LinkedIn API response

export interface CurrentCompany {
  company_id: string;
  link: string;
  location: string | null;
  name: string;
}

export interface Experience {
  company: string;
  company_logo_url?: string;
  description_html: string | null;
  duration?: string;
  subtitle?: string;
  title: string;
}

export interface Education {
  description: string | null;
  description_html: string | null;
  end_year?: string;
  institute_logo_url: string | null;
  start_year?: string;
  title?: string;
  url?: string;
}

export interface Language {
  subtitle: string;
  title: string;
}

export interface Activity {
  id: string;
  img: string | null;
  interaction: string;
  link: string;
  title: string;
}

export interface HonorAward {
  date: string;
  description: string;
  publication: string;
  title: string;
}

// Raw response from Bright Data LinkedIn API
export interface BrightDataLinkedInResponse {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  city: string;
  country_code: string;
  position: string | null;
  about: string | null;
  posts: unknown | null;
  current_company: CurrentCompany | null;
  experience: Experience[];
  url: string;
  people_also_viewed: unknown | null;
  educations_details: string | null;
  education: Education[];
  recommendations_count: number | null;
  avatar: string;
  courses: unknown | null;
  languages: Language[];
  certifications: unknown | null;
  recommendations: unknown | null;
  volunteer_experience: unknown | null;
  followers: number;
  connections: number;
  current_company_company_id: string | null;
  current_company_name: string | null;
  publications: unknown | null;
  patents: unknown | null;
  projects: unknown | null;
  organizations: unknown | null;
  location: string;
  input_url: string;
  linkedin_id: string;
  activity: Activity[];
  linkedin_num_id: string;
  banner_image: string;
  honors_and_awards: HonorAward[];
  similar_profiles: unknown[];
  default_avatar: boolean;
  memorialized_account: boolean;
  bio_links: unknown[];
}

// Simplified type for what we store in our database (matches Prisma schema)
export interface ProfileData {
  linkedinUrl: string;
  linkedinId: string;
  linkedinNumId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline?: string;
  about?: string;
  location?: string;
  city?: string;
  countryCode?: string;
  profilePicUrl?: string;
  bannerImage?: string;
  defaultAvatar?: boolean;
  currentCompany?: string;
  currentCompanyId?: string;
  experience?: Experience[];
  education?: Education[];
  languages?: Language[];
  connections?: number;
  followers?: number;
  memorializedAccount?: boolean;
}

// Helper function to transform Bright Data response to our ProfileData format
export function transformBrightDataProfile(
  data: BrightDataLinkedInResponse
): ProfileData {
  return {
    linkedinUrl: data.url,
    linkedinId: data.linkedin_id,
    linkedinNumId: data.linkedin_num_id,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: data.name,
    headline: data.position || undefined,
    about: data.about || undefined,
    location: data.location,
    city: data.city,
    countryCode: data.country_code,
    profilePicUrl: data.avatar,
    bannerImage: data.banner_image,
    defaultAvatar: data.default_avatar,
    currentCompany: data.current_company_name || undefined,
    currentCompanyId: data.current_company_company_id || undefined,
    experience: data.experience,
    education: data.education,
    languages: data.languages,
    connections: data.connections,
    followers: data.followers,
    memorializedAccount: data.memorialized_account,
  };
}
