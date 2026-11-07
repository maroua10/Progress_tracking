import LoginForm from '../../components/login-form';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {error}=await searchParams;
 const errors:Record<string,string>={invitation:'Ce lien d’invitation a expiré, a été révoqué ou a déjà servi. Si votre compte est créé, connectez-vous ci-dessous.',expired:'Ce lien a expiré ou a déjà été utilisé. Demandez un nouvel e-mail.',forbidden:'Ce compte n’est pas autorisé dans cet espace. Utilisez l’un des deux comptes autorisés.',google:'La connexion Google n’est pas disponible. Vérifiez sa configuration ou utilisez votre mot de passe.'};
 return <LoginForm configured={!!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.DATABASE_URL && process.env.APP_URL)} initialError={error?errors[error]:undefined}/>;
}
