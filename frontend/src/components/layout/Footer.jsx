import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <span>© {new Date().getFullYear()} Peredent</span>
      <span>v0.1.0</span>
    </footer>
  );
};

export default Footer;
