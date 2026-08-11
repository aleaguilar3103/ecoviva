import LoginCard from "../auth/LoginCard";

// El formulario vive en LoginCard porque la guía de vendedores lo reutiliza.
export default function AdminLogin() {
  return <LoginCard title="EcoViva" subtitle="Panel de administración" />;
}
