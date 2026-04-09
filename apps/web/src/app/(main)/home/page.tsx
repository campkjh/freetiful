'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Bell, Star, ChevronRight, ChevronLeft, ArrowRight, MapPin, Gift } from 'lucide-react';
import StackBanner from '@/components/home/StackBanner';
import { triggerFavoriteAnimation } from '@/components/FavoriteAnimation';

/* ─── Scroll Reveal Hook ──────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Reveal Wrapper ─────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-6 opacity-0 blur-[3px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Count-Up Animation ─────────────────────────────────── */
function CountUpText({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal(0.3);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const duration = 1200;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, value]);
  return <span ref={ref}>{count}{suffix}</span>;
}

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 275 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M245.215 69.6595C244.99 69.837 244.811 70.0662 244.693 70.3279C243.015 72.9488 240.547 74.9581 237.651 76.0597C236.34 76.5622 234.962 76.8626 233.563 76.9508C232.02 77.0731 230.467 76.9665 228.954 76.6345C225.804 75.8971 223.63 74.0058 222.374 71.0207C221.74 69.4354 221.339 67.7657 221.184 66.064C221.067 64.9311 221.013 63.7924 221.022 62.6534C221.022 57.7525 221.022 52.8515 221.022 47.9506C221.008 47.3818 221.051 46.8131 221.151 46.2531C221.484 44.6255 222.406 43.1806 223.737 42.1991C225.068 41.2175 226.715 40.7693 228.356 40.9414C229.997 41.1135 231.516 41.8937 232.618 43.1305C233.72 44.3673 234.326 45.9724 234.32 47.6343C234.333 48.8461 234.32 50.0602 234.32 51.2721C234.32 53.9706 234.32 56.6683 234.32 59.3653C234.321 60.7033 234.523 62.0333 234.919 63.3106C235.1 63.9021 235.351 64.4692 235.669 64.9992C235.932 65.4477 236.268 65.849 236.662 66.1866C237.223 66.678 237.926 66.9738 238.667 67.03C239.409 67.0862 240.148 66.8997 240.776 66.4984C241.437 66.0651 242.002 65.4994 242.437 64.8366C243.272 63.5768 243.827 62.1506 244.065 60.6552C244.182 59.9187 244.232 59.1731 244.215 58.4275C244.215 54.8141 244.215 51.2008 244.215 47.5875C244.197 45.815 244.879 44.1079 246.11 42.8416C247.342 41.5753 249.022 40.8536 250.782 40.8353C252.542 40.817 254.237 41.5035 255.494 42.7439C256.751 43.9843 257.468 45.6769 257.486 47.4494C257.486 47.5986 257.486 47.7479 257.486 47.8949C257.486 56.9542 257.486 66.0135 257.486 75.0729C257.486 76.1355 257.612 75.9862 256.601 75.9884C253.089 75.9884 249.576 75.9884 246.064 75.9884H245.697C245.213 75.9884 245.206 75.9884 245.204 75.4872C245.204 73.8268 245.204 72.1687 245.204 70.5128L245.215 69.6595Z" fill="currentColor"/>
      <path d="M132.854 61.7201C130.251 61.7201 127.647 61.7201 125.044 61.7201C124.31 61.7201 124.381 61.7624 124.425 62.3616C124.462 63.4765 124.686 64.577 125.088 65.6163C125.261 66.0523 125.484 66.4665 125.752 66.8505C126.107 67.3726 126.565 67.815 127.098 68.1498C127.631 68.4845 128.227 68.7043 128.848 68.7952C130.731 69.1139 132.665 68.7743 134.329 67.8329C134.84 67.5366 135.332 67.2085 135.802 66.8505C136.158 66.5876 136.521 66.3336 136.888 66.0841C139.1 64.5827 142.21 65.6185 143.223 68.2249C143.611 69.1724 143.666 70.2248 143.38 71.2083C143.094 72.1918 142.483 73.0474 141.648 73.6338C139.919 74.8641 137.984 75.7697 135.935 76.3071C134.222 76.7497 132.462 76.9852 130.693 77.0088C128.434 77.0819 126.175 76.8466 123.978 76.3093C121.07 75.5697 118.462 74.2531 116.268 72.1635C114.538 70.5331 113.206 68.5218 112.375 66.2868C110.506 61.2634 110.451 56.2199 112.457 51.2254C113.604 48.2961 115.529 45.7418 118.023 43.8429C120.517 41.944 123.482 40.7739 126.592 40.4611C129.704 40.1147 132.853 40.4841 135.802 41.5415C139.503 42.8782 142.241 45.3554 144.05 48.8707C145.178 51.0489 145.884 53.4236 146.129 55.8679C146.335 57.933 145.466 59.5726 143.782 60.7688C142.781 61.4772 141.637 61.7201 140.434 61.7245C138.764 61.7245 137.094 61.7245 135.424 61.7245L132.854 61.7201ZM124.845 53.658C125.023 53.7447 125.224 53.7713 125.418 53.7338H132.56C133.354 53.7338 133.223 53.7204 133.102 53.0432C132.93 51.965 132.54 50.9338 131.956 50.0135C131.273 48.9887 130.346 48.3784 129.098 48.2982C127.911 48.2247 126.929 48.6056 126.194 49.568C125.943 49.9042 125.732 50.27 125.568 50.6573C125.285 51.3158 125.079 52.005 124.954 52.7112C124.892 53.0231 124.761 53.3283 124.845 53.658Z" fill="currentColor"/>
      <path d="M95.2207 61.7212H87.6321C87.4352 61.7212 87.2384 61.7212 87.0415 61.7212C86.8447 61.7212 86.7894 61.7992 86.7938 62.0042C86.8181 63.4032 87.0305 64.7643 87.6542 66.0319C88.4703 67.6893 89.7753 68.6516 91.6177 68.841C92.3748 68.9265 93.1397 68.9137 93.8936 68.8031C95.257 68.5833 96.5494 68.0413 97.6647 67.2214C98.1668 66.865 98.6556 66.4908 99.1665 66.1477C99.6689 65.7891 100.244 65.5465 100.85 65.4371C101.853 65.3055 102.872 65.5186 103.74 66.0417C104.609 66.5648 105.277 67.3675 105.637 68.3202C105.997 69.2729 106.028 70.32 105.724 71.2924C105.42 72.2648 104.8 73.1058 103.964 73.6795C102.103 74.9802 100.014 75.9144 97.8085 76.433C96.2518 76.7886 94.6625 76.9797 93.0664 77.0033C91.0288 77.0694 88.9907 76.8907 86.9951 76.4709C84.6795 75.989 82.4815 75.0501 80.5278 73.7085C77.7122 71.7437 75.7703 69.0994 74.5936 65.8737C74.0202 64.2663 73.6486 62.5929 73.4877 60.8925C73.1895 58.1783 73.4554 55.4312 74.2685 52.826C75.7327 48.1857 78.5195 44.6192 82.8192 42.3224C84.804 41.2731 86.9775 40.6353 89.2113 40.4467C91.9317 40.185 94.6766 40.4589 97.2931 41.2531C101.739 42.6076 104.897 45.4546 106.828 49.6961C107.692 51.6138 108.258 53.6536 108.507 55.7443C108.847 58.4621 106.959 61.0908 104.128 61.6121C103.643 61.6983 103.153 61.7401 102.661 61.7368C100.18 61.7235 97.6994 61.7183 95.2207 61.7212ZM91.3324 53.7483H94.8712C95.0437 53.7483 95.2163 53.7483 95.3866 53.7483C95.5569 53.7483 95.5878 53.6391 95.5635 53.4943C95.4226 52.4879 95.124 51.5104 94.6788 50.5983C94.3281 49.8564 93.774 49.2311 93.0819 48.7961C92.3095 48.3155 91.3795 48.1629 90.4956 48.3717C89.6117 48.5805 88.8461 49.1336 88.3664 49.91C87.6697 51.0238 87.3954 52.278 87.1963 53.5523C87.192 53.5768 87.1931 53.602 87.1998 53.626C87.2065 53.6499 87.2185 53.6721 87.2349 53.6907C87.2512 53.7094 87.2716 53.7241 87.2944 53.7337C87.3173 53.7432 87.342 53.7475 87.3666 53.7461C87.537 53.7572 87.7095 53.7572 87.882 53.7572L91.3324 53.7483Z" fill="currentColor"/>
      <path d="M210.563 62.456V75.0759C210.563 75.2987 210.563 75.5215 210.563 75.7443C210.564 75.7746 210.56 75.805 210.55 75.8336C210.539 75.8622 210.523 75.8884 210.503 75.9105C210.482 75.9326 210.457 75.9502 210.429 75.9623C210.401 75.9743 210.372 75.9804 210.341 75.9804C210.195 75.9804 210.047 75.9804 209.899 75.9804H197.955C197.261 75.9804 197.292 76.0383 197.292 75.2898C197.292 66.777 197.292 58.265 197.292 49.7537C197.292 49.5309 197.292 49.3081 197.292 49.0854C197.293 49.0482 197.286 49.0113 197.272 48.977C197.258 48.9428 197.236 48.9122 197.209 48.8874C197.181 48.8625 197.149 48.844 197.113 48.8332C197.078 48.8224 197.041 48.8195 197.004 48.8247C196.71 48.8247 196.416 48.8247 196.12 48.8091C195.259 48.7843 194.431 48.4764 193.76 47.9325C193.09 47.3885 192.615 46.6385 192.408 45.797C192.202 44.9556 192.274 44.069 192.615 43.2729C192.955 42.4768 193.545 41.815 194.295 41.3886C194.851 41.0667 195.48 40.8927 196.122 40.883C196.416 40.883 196.71 40.883 197.006 40.883C197.043 40.8882 197.081 40.8853 197.116 40.8743C197.152 40.8634 197.184 40.8447 197.212 40.8196C197.239 40.7945 197.261 40.7636 197.275 40.7291C197.289 40.6946 197.296 40.6574 197.294 40.6201C197.294 40.4218 197.294 40.2236 197.294 40.0253C197.294 38.7399 197.294 37.4523 197.294 36.1647C197.288 34.7288 197.504 33.3008 197.935 31.9321C198.853 29.0895 200.709 27.1447 203.48 26.091C205.074 25.499 206.76 25.1973 208.459 25.1999C210.52 25.1799 212.584 25.2133 214.652 25.1888C215.694 25.1755 216.699 25.5798 217.446 26.3128C218.192 27.0458 218.619 28.0474 218.632 29.0973C218.645 30.1472 218.244 31.1594 217.516 31.9112C216.788 32.6629 215.794 33.0928 214.752 33.106C214.285 33.1087 213.821 33.1693 213.369 33.2865C211.702 33.7632 210.812 35.1132 210.616 36.6102C210.588 36.8811 210.577 37.1534 210.582 37.4256C210.582 38.2921 210.582 39.1587 210.582 40.0253C210.582 40.9698 210.483 40.8763 211.467 40.8785C212.522 40.8785 213.579 40.8785 214.634 40.8785C215.252 40.8656 215.863 41.0063 216.414 41.288C216.965 41.5697 217.439 41.9837 217.793 42.4936C218.702 43.7634 218.839 45.1535 218.164 46.5636C217.881 47.2154 217.417 47.7716 216.829 48.1664C216.241 48.5612 215.553 48.778 214.847 48.7913C213.697 48.8514 212.54 48.8113 211.385 48.818C210.525 48.818 210.582 48.7178 210.582 49.6022L210.563 62.456Z" fill="currentColor"/>
      <path d="M151.512 57.4083V49.7628C151.512 49.5646 151.512 49.3663 151.512 49.168C151.512 48.8896 151.45 48.8428 151.149 48.8339C150.848 48.825 150.609 48.8339 150.339 48.8205C149.441 48.7908 148.58 48.4529 147.899 47.8628C147.218 47.2727 146.757 46.4658 146.593 45.5759C146.43 44.6859 146.573 43.7664 146.999 42.9696C147.425 42.1729 148.109 41.5468 148.937 41.1951C149.367 41.0095 149.828 40.9089 150.295 40.8988C150.589 40.8988 150.886 40.8988 151.18 40.8854C151.474 40.8721 151.512 40.8186 151.512 40.5179C151.512 39.1812 151.512 37.8446 151.512 36.508C151.502 35.4156 151.751 34.3367 152.237 33.3603C152.869 32.113 153.874 31.0966 155.109 30.454C156.344 29.8114 157.748 29.5748 159.124 29.7777C160.5 29.9805 161.778 30.6125 162.779 31.5847C163.779 32.557 164.452 33.8207 164.703 35.1981C164.781 35.6863 164.817 36.1806 164.809 36.6751C164.822 37.8379 164.809 39.0008 164.809 40.1637C164.809 40.3374 164.809 40.5112 164.829 40.6827C164.831 40.7328 164.851 40.7803 164.887 40.8155C164.922 40.8507 164.969 40.871 165.019 40.8721C165.189 40.8854 165.362 40.8877 165.534 40.8877H168.852C169.394 40.8756 169.932 40.9828 170.429 41.2017C170.925 41.4206 171.368 41.746 171.727 42.1552C172.833 43.3938 173.103 44.8285 172.479 46.3611C172.224 47.0668 171.763 47.6783 171.157 48.1156C170.551 48.5529 169.828 48.7955 169.082 48.8116C167.956 48.8784 166.824 48.8317 165.694 48.8406C164.749 48.8406 164.809 48.7114 164.809 49.6938C164.809 54.2717 164.844 58.8496 164.793 63.4253C164.769 65.6085 166.101 67.2302 168.155 67.8161C168.771 67.9904 169.407 68.0744 170.046 68.0656C170.414 68.0656 170.783 68.0656 171.152 68.0656C171.189 68.0617 171.226 68.0661 171.261 68.0786C171.296 68.0912 171.328 68.1115 171.354 68.1381C171.379 68.1646 171.399 68.1968 171.411 68.2321C171.423 68.2673 171.427 68.3049 171.422 68.3419C171.422 68.4399 171.422 68.5401 171.422 68.6382V75.3925C171.422 75.5173 171.422 75.6398 171.422 75.7623C171.422 75.7936 171.416 75.8245 171.403 75.8531C171.391 75.8817 171.373 75.9073 171.35 75.9283C171.327 75.9493 171.3 75.9652 171.27 75.975C171.241 75.9848 171.21 75.9882 171.179 75.9851H170.885C168.306 75.9851 165.727 76.0163 163.143 75.974C161.4 75.9688 159.668 75.6853 158.012 75.1341C156.699 74.7069 155.495 73.9934 154.487 73.0445C153.124 71.7347 152.346 70.1107 151.928 68.2906C151.638 66.9855 151.498 65.6514 151.509 64.3142C151.514 62.0122 151.515 59.7103 151.512 57.4083Z" fill="currentColor"/>
      <path d="M274.989 53.4241C274.989 60.6508 274.989 67.8767 274.989 75.1019C274.989 76.0977 275.098 75.993 274.142 75.993H262.577C262.404 75.993 262.234 75.993 262.061 75.993C261.774 75.9818 261.734 75.9395 261.723 75.6365C261.723 75.4628 261.723 75.289 261.723 75.1153C261.723 60.7896 261.723 46.4626 261.723 32.134C261.69 30.8413 262.016 29.5649 262.665 28.4494C263.352 27.2962 264.368 26.3781 265.58 25.8146C266.793 25.251 268.145 25.0682 269.462 25.2898C270.779 25.5114 271.999 26.1273 272.964 27.0572C273.928 27.987 274.592 29.1879 274.87 30.5033C274.965 30.9888 275.008 31.4832 274.998 31.978C274.991 39.1245 274.988 46.2732 274.989 53.4241Z" fill="currentColor"/>
      <path d="M55.2947 47.2888C55.5191 47.1644 55.7045 46.9792 55.8299 46.7542C57.0965 45.0749 58.6507 43.637 60.4194 42.5082C62.7419 41.0358 65.4436 40.285 68.1871 40.3495C70.1778 40.3874 71.7525 41.2183 72.77 42.9649C73.38 43.9669 73.6294 45.1498 73.4764 46.315C73.3234 47.4803 72.7772 48.5572 71.9295 49.3651C71.5094 49.7815 71.0616 50.1685 70.5891 50.5235C68.7335 51.8356 66.8004 51.8601 64.8275 50.7975C64.4013 50.5489 64.0062 50.2497 63.6508 49.9064C63.1415 49.4354 62.5184 49.1074 61.8438 48.9552C60.6693 48.7012 59.6585 49.042 58.7782 49.8217C58.247 50.3046 57.8156 50.8883 57.5087 51.5393C56.9075 52.8165 56.5389 54.192 56.4205 55.6004C56.3303 56.4885 56.289 57.3809 56.2966 58.2736C56.2966 63.9171 56.2966 69.5607 56.2966 75.2042C56.2966 76.0952 56.3718 76.0039 55.5114 76.0039H43.7226C42.9684 76.0039 42.9972 76.0663 42.9972 75.2866C42.9972 68.0094 42.9972 60.7323 42.9972 53.4551C42.9972 51.2274 42.9972 48.9997 42.9972 46.772C42.9775 45.6787 43.2307 44.5978 43.7337 43.6287C44.374 42.4246 45.3918 41.4677 46.6285 40.9072C47.8652 40.3466 49.2513 40.2139 50.5707 40.5297C51.8902 40.8456 53.0688 41.5922 53.9228 42.6532C54.7769 43.7142 55.2585 45.03 55.2925 46.3955C55.2991 46.6517 55.2947 46.9213 55.2947 47.2888Z" fill="currentColor"/>
      <path d="M189.186 61.4459C189.186 65.9978 189.186 70.549 189.186 75.0995C189.186 76.1042 189.284 75.9906 188.342 75.9906C184.464 75.9906 180.586 75.9906 176.708 75.9906C175.823 75.9906 175.898 76.1242 175.898 75.144V62.6689C175.898 57.6967 175.898 52.7252 175.898 47.7544C175.898 46.195 176.292 44.7582 177.256 43.5329C179.012 41.3052 181.324 40.4431 184.057 41.0825C186.791 41.7218 188.417 43.5329 189.06 46.2463C189.163 46.7301 189.209 47.2242 189.198 47.7188C189.184 52.293 189.181 56.8687 189.186 61.4459Z" fill="currentColor"/>
      <path d="M182.525 25.2052C182.894 25.2052 183.261 25.2052 183.631 25.2052C185.993 25.154 188.581 26.9607 189.098 29.8834C189.345 31.2975 189.052 32.7531 188.279 33.9595C187.506 35.1658 186.31 36.034 184.929 36.3905C184.788 36.4304 184.645 36.4617 184.5 36.4841C183.257 36.6352 182 36.6404 180.755 36.4997C179.451 36.3145 178.251 35.6757 177.365 34.6938C176.479 33.7118 175.961 32.4487 175.902 31.1229C175.843 29.7972 176.246 28.4924 177.042 27.4345C177.837 26.3765 178.975 25.6321 180.258 25.33C180.639 25.24 181.029 25.1951 181.421 25.1963L182.525 25.2052Z" fill="currentColor"/>
      <path d="M17.2666 57.9817C17.1449 58.2356 17.2068 58.5096 17.2068 58.7725C17.2068 63.5249 17.2068 68.2774 17.2068 73.0298C17.2125 74.2234 16.918 75.399 16.3509 76.4471C15.6603 77.7145 14.5892 78.7292 13.2911 79.3459C11.9929 79.9627 10.5342 80.1498 9.12403 79.8805C7.71381 79.6112 6.42438 78.8993 5.44043 77.8468C4.45648 76.7943 3.82848 75.4551 3.6464 74.0211C3.60514 73.6781 3.58372 73.333 3.58226 72.9875C3.58226 61.8245 3.54908 50.6615 3.59331 39.4984C3.61101 34.4772 5.48439 30.1978 9.08959 26.7181C11.1377 24.7421 13.5375 23.3142 16.1496 22.2271C18.7702 21.1623 21.5091 20.421 24.3067 20.0194C26.9803 19.6312 29.6784 19.4384 32.3797 19.4424C34.1403 19.4568 35.827 20.1579 37.0852 21.3985C38.3435 22.639 39.0754 24.3225 39.1272 26.0951C39.179 27.8678 38.5467 29.5917 37.3631 30.9046C36.1795 32.2176 34.5368 33.0174 32.78 33.1361C32.0457 33.1762 31.3092 33.1762 30.5682 33.203C28.0628 33.2603 25.5735 33.6223 23.1543 34.2812C22.1351 34.5622 21.1482 34.9512 20.2104 35.4418C19.7103 35.7067 19.2369 36.0201 18.7971 36.3774C17.7642 37.2173 17.1737 38.2843 17.1825 39.6455C17.1767 40.0175 17.1944 40.3895 17.2356 40.7593C17.3708 41.7504 17.8773 42.6518 18.6511 43.2789C19.5672 44.0309 20.6185 44.5981 21.7476 44.9496C23.4504 45.5211 25.2345 45.8085 27.0294 45.8006C27.3722 45.8006 27.715 45.7494 28.0578 45.7271C31.0061 45.5221 33.3219 46.6405 34.7728 49.2446C35.2854 50.1663 35.5787 51.1951 35.6297 52.2502C35.6807 53.3053 35.488 54.358 35.0668 55.3255C34.6456 56.2929 34.0074 57.1488 33.2022 57.8257C32.3971 58.5027 31.447 58.9824 30.4267 59.227C29.7804 59.3758 29.1209 59.4587 28.4582 59.4742C26.8352 59.5561 25.2084 59.5114 23.5922 59.3406C21.6413 59.118 19.7158 58.7093 17.8416 58.1198C17.6609 58.0357 17.4654 57.9888 17.2666 57.9817Z" fill="#0B58FF"/>
      <path d="M9.1809 18.7724C4.38134 18.8593 -0.0024175 14.8383 0.00421785 9.52971C-0.0330545 8.29147 0.177013 7.05831 0.621953 5.9034C1.06689 4.74849 1.73764 3.69538 2.59439 2.80655C3.45114 1.91772 4.47643 1.21129 5.60942 0.729182C6.74241 0.247072 7.96001 -0.000893105 9.18996 2.41698e-06C10.4199 0.000897939 11.6372 0.250634 12.7695 0.734393C13.9018 1.21815 14.926 1.92608 15.7815 2.81615C16.637 3.70623 17.3062 4.76032 17.7495 5.91588C18.1928 7.07143 18.4011 8.30489 18.362 9.54308C18.3598 14.845 14.0137 18.8638 9.1809 18.7724Z" fill="#68DEFF"/>
    </svg>
  );
}

const MOCK_PROS = [
  { id: '1', name: '박인애', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 15, pudding: 1, image: 'https://i.pravatar.cc/300?img=1', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/200?img=14', 'https://i.pravatar.cc/200?img=15'], intro: '우아하고 위트있는 진행의 정석', price: 500000, experience: 13, tags: ['전국가능', '우아한', '위트있는'], available: true },
  { id: '2', name: '김서현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 142, pudding: 2, image: 'https://i.pravatar.cc/300?img=5', images: ['https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/200?img=16', 'https://i.pravatar.cc/200?img=17'], intro: '감동과 웃음을 동시에 선사하는 웨딩 전문 MC', price: 550000, experience: 15, tags: ['서울/경기', '감동적인', '유머러스한'], available: true },
  { id: '3', name: '이하늘', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 98, pudding: 3, image: 'https://i.pravatar.cc/300?img=9', images: ['https://i.pravatar.cc/300?img=9', 'https://i.pravatar.cc/200?img=18', 'https://i.pravatar.cc/200?img=19'], intro: '섬세한 진행력으로 당신의 하루를 완성합니다', price: 450000, experience: 8, tags: ['서울/경기', '섬세한', '전문적인'], available: true },
  { id: '4', name: '정다은', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 67, pudding: 4, image: 'https://i.pravatar.cc/300?img=10', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/200?img=20', 'https://i.pravatar.cc/200?img=21'], intro: '격식과 유쾌함의 완벽한 밸런스', price: 480000, experience: 10, tags: ['전국가능', '격식있는', '유쾌한'], available: true },
  { id: '5', name: '최수아', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 55, pudding: 5, image: 'https://i.pravatar.cc/300?img=12', images: ['https://i.pravatar.cc/300?img=12', 'https://i.pravatar.cc/200?img=22', 'https://i.pravatar.cc/200?img=23'], intro: '따뜻한 목소리로 행사를 빛내드립니다', price: 420000, experience: 6, tags: ['전국가능', '따뜻한', '차분한'], available: false },
  { id: '6', name: '한도윤', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 89, pudding: 6, image: 'https://i.pravatar.cc/300?img=11', images: ['https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/200?img=24', 'https://i.pravatar.cc/200?img=25'], intro: '부산 경남 지역 인기 1위 웨딩 MC', price: 400000, experience: 11, tags: ['경상권', '위트있는', '에너지넘치는'], available: true },
  { id: '7', name: '윤지민', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 120, pudding: 7, image: 'https://i.pravatar.cc/300?img=2', images: ['https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/200?img=26', 'https://i.pravatar.cc/200?img=27'], intro: '프리미엄 웨딩 전문 사회자', price: 600000, experience: 18, tags: ['서울/경기', '프리미엄', '세련된'], available: true },
  { id: '8', name: '송예은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 43, pudding: 8, image: 'https://i.pravatar.cc/300?img=3', images: ['https://i.pravatar.cc/300?img=3', 'https://i.pravatar.cc/200?img=28', 'https://i.pravatar.cc/200?img=29'], intro: '밝고 에너지 넘치는 행사 진행자', price: 350000, experience: 4, tags: ['서울/경기', '밝은', '에너지넘치는'], available: true },
  { id: '9', name: '장민서', category: 'MC', role: '사회자', region: '충청', rating: 4.8, reviews: 76, pudding: 9, image: 'https://i.pravatar.cc/300?img=4', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/200?img=30', 'https://i.pravatar.cc/200?img=31'], intro: '대전 충남 지역 웨딩 MC 1위', price: 380000, experience: 9, tags: ['충청권', '친근한', '안정적인'], available: true },
  { id: '10', name: '오서진', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 201, pudding: 10, image: 'https://i.pravatar.cc/300?img=6', images: ['https://i.pravatar.cc/300?img=6', 'https://i.pravatar.cc/200?img=32', 'https://i.pravatar.cc/200?img=33'], intro: '200회 이상 진행한 베테랑 사회자', price: 700000, experience: 20, tags: ['전국가능', '베테랑', '감동적인'], available: true },
  { id: '11', name: '권나은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 38, pudding: 11, image: 'https://i.pravatar.cc/300?img=7', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/200?img=34', 'https://i.pravatar.cc/200?img=35'], intro: '아나운서 출신 깔끔한 진행', price: 520000, experience: 7, tags: ['서울/경기', '깔끔한', '아나운서출신'], available: true },
  { id: '12', name: '임채원', category: 'MC', role: '사회자', region: '전라', rating: 4.9, reviews: 94, pudding: 12, image: 'https://i.pravatar.cc/300?img=8', images: ['https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/200?img=36', 'https://i.pravatar.cc/200?img=37'], intro: '호남 지역 최고 인기 웨딩 MC', price: 400000, experience: 12, tags: ['전라권', '다정한', '유머러스한'], available: false },
  { id: '13', name: '배수현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 63, pudding: 13, image: 'https://i.pravatar.cc/300?img=13', images: ['https://i.pravatar.cc/300?img=13', 'https://i.pravatar.cc/200?img=38', 'https://i.pravatar.cc/200?img=39'], intro: '기업행사 전문 MC', price: 650000, experience: 14, tags: ['서울/경기', '전문적인', '격식있는'], available: true },
  { id: '14', name: '유하영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 29, pudding: 14, image: 'https://i.pravatar.cc/300?img=15', images: ['https://i.pravatar.cc/300?img=15', 'https://i.pravatar.cc/200?img=40', 'https://i.pravatar.cc/200?img=41'], intro: '돌잔치 전문 사회자', price: 300000, experience: 3, tags: ['서울/경기', '따뜻한', '돌잔치전문'], available: true },
  { id: '15', name: '남지우', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 157, pudding: 15, image: 'https://i.pravatar.cc/300?img=16', images: ['https://i.pravatar.cc/300?img=16', 'https://i.pravatar.cc/200?img=42', 'https://i.pravatar.cc/200?img=43'], intro: '감성 웨딩의 완성, 진심을 전하는 MC', price: 550000, experience: 16, tags: ['전국가능', '감성적인', '진심어린'], available: true },
  { id: '16', name: '강예린', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 51, pudding: 16, image: 'https://i.pravatar.cc/300?img=17', images: ['https://i.pravatar.cc/300?img=17', 'https://i.pravatar.cc/200?img=44', 'https://i.pravatar.cc/200?img=45'], intro: '톡톡 튀는 진행으로 분위기 메이커', price: 380000, experience: 5, tags: ['서울/경기', '톡톡튀는', '분위기메이커'], available: true },
  { id: '17', name: '문소율', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 82, pudding: 17, image: 'https://i.pravatar.cc/300?img=18', images: ['https://i.pravatar.cc/300?img=18', 'https://i.pravatar.cc/200?img=46', 'https://i.pravatar.cc/200?img=47'], intro: '대구 경북 지역 웨딩 전문', price: 370000, experience: 9, tags: ['경상권', '우아한', '안정적인'], available: true },
  { id: '18', name: '서윤아', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 178, pudding: 18, image: 'https://i.pravatar.cc/300?img=19', images: ['https://i.pravatar.cc/300?img=19', 'https://i.pravatar.cc/200?img=48', 'https://i.pravatar.cc/200?img=49'], intro: '고급 호텔웨딩 전문 MC', price: 800000, experience: 22, tags: ['서울/경기', '프리미엄', '호텔웨딩전문'], available: false },
  { id: '19', name: '홍채린', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 46, pudding: 19, image: 'https://i.pravatar.cc/300?img=20', images: ['https://i.pravatar.cc/300?img=20', 'https://i.pravatar.cc/200?img=50', 'https://i.pravatar.cc/200?img=51'], intro: '영어 이중언어 MC, 국제결혼 전문', price: 600000, experience: 8, tags: ['전국가능', '이중언어', '국제결혼전문'], available: true },
  { id: '20', name: '안소희', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 110, pudding: 20, image: 'https://i.pravatar.cc/300?img=21', images: ['https://i.pravatar.cc/300?img=21', 'https://i.pravatar.cc/200?img=52', 'https://i.pravatar.cc/200?img=53'], intro: '웃음 가득한 행복한 웨딩 진행', price: 480000, experience: 11, tags: ['서울/경기', '유쾌한', '행복한'], available: true },
  { id: '21', name: '조하은', category: 'MC', role: '사회자', region: '충청', rating: 4.6, reviews: 34, pudding: 21, image: 'https://i.pravatar.cc/300?img=22', images: ['https://i.pravatar.cc/300?img=22', 'https://i.pravatar.cc/200?img=54', 'https://i.pravatar.cc/200?img=55'], intro: '세종 대전 지역 밀착 MC', price: 330000, experience: 4, tags: ['충청권', '친근한', '밀착형'], available: true },
  { id: '22', name: '김나영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 73, pudding: 22, image: 'https://i.pravatar.cc/300?img=23', images: ['https://i.pravatar.cc/300?img=23', 'https://i.pravatar.cc/200?img=56', 'https://i.pravatar.cc/200?img=57'], intro: '차분하고 우아한 예식 진행', price: 500000, experience: 12, tags: ['서울/경기', '차분한', '우아한'], available: true },
  { id: '23', name: '이수빈', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 131, pudding: 23, image: 'https://i.pravatar.cc/300?img=24', images: ['https://i.pravatar.cc/300?img=24', 'https://i.pravatar.cc/200?img=58', 'https://i.pravatar.cc/200?img=59'], intro: '방송인 출신 프로페셔널 MC', price: 650000, experience: 17, tags: ['전국가능', '방송인출신', '프로페셔널'], available: true },
  { id: '24', name: '박지현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 22, pudding: 24, image: 'https://i.pravatar.cc/300?img=25', images: ['https://i.pravatar.cc/300?img=25', 'https://i.pravatar.cc/200?img=60', 'https://i.pravatar.cc/200?img=61'], intro: '소규모 웨딩 전문 아담한 진행', price: 280000, experience: 2, tags: ['서울/경기', '소규모전문', '아담한'], available: true },
  { id: '25', name: '윤서아', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 88, pudding: 25, image: 'https://i.pravatar.cc/300?img=26', images: ['https://i.pravatar.cc/300?img=26', 'https://i.pravatar.cc/200?img=62', 'https://i.pravatar.cc/200?img=63'], intro: '울산 경남 웨딩 MC 전문가', price: 380000, experience: 10, tags: ['경상권', '센스있는', '전문적인'], available: true },
  { id: '26', name: '전다인', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 59, pudding: 26, image: 'https://i.pravatar.cc/300?img=27', images: ['https://i.pravatar.cc/300?img=27', 'https://i.pravatar.cc/200?img=64', 'https://i.pravatar.cc/200?img=65'], intro: '생신잔치·칠순 전문 MC', price: 350000, experience: 7, tags: ['전국가능', '공손한', '생신잔치전문'], available: true },
  { id: '27', name: '노은서', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 145, pudding: 27, image: 'https://i.pravatar.cc/300?img=28', images: ['https://i.pravatar.cc/300?img=28', 'https://i.pravatar.cc/200?img=66', 'https://i.pravatar.cc/200?img=67'], intro: '눈물과 감동이 있는 웨딩 MC', price: 520000, experience: 13, tags: ['서울/경기', '감동적인', '눈물샘자극'], available: false },
  { id: '28', name: '하지원', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 71, pudding: 28, image: 'https://i.pravatar.cc/300?img=29', images: ['https://i.pravatar.cc/300?img=29', 'https://i.pravatar.cc/200?img=68', 'https://i.pravatar.cc/200?img=69'], intro: '진정성 있는 따뜻한 사회 진행', price: 450000, experience: 9, tags: ['서울/경기', '진정성있는', '따뜻한'], available: true },
  { id: '29', name: '고유나', category: 'MC', role: '사회자', region: '제주', rating: 4.7, reviews: 41, pudding: 29, image: 'https://i.pravatar.cc/300?img=30', images: ['https://i.pravatar.cc/300?img=30', 'https://i.pravatar.cc/200?img=1', 'https://i.pravatar.cc/200?img=2'], intro: '제주도 야외웨딩 전문 MC', price: 450000, experience: 6, tags: ['제주', '야외웨딩전문', '자유로운'], available: true },
  { id: '30', name: '심보라', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 189, pudding: 30, image: 'https://i.pravatar.cc/300?img=31', images: ['https://i.pravatar.cc/300?img=31', 'https://i.pravatar.cc/200?img=3', 'https://i.pravatar.cc/200?img=4'], intro: '15년 경력의 대한민국 대표 웨딩 MC', price: 750000, experience: 15, tags: ['전국가능', '대표MC', '격식있는'], available: true },
  { id: '31', name: '류세은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 27, pudding: 31, image: 'https://i.pravatar.cc/300?img=32', images: ['https://i.pravatar.cc/300?img=32', 'https://i.pravatar.cc/200?img=5', 'https://i.pravatar.cc/200?img=6'], intro: '신선하고 트렌디한 MZ 웨딩 MC', price: 350000, experience: 3, tags: ['서울/경기', '트렌디한', 'MZ감성'], available: true },
  { id: '32', name: '탁예나', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 85, pudding: 32, image: 'https://i.pravatar.cc/300?img=33', images: ['https://i.pravatar.cc/300?img=33', 'https://i.pravatar.cc/200?img=7', 'https://i.pravatar.cc/200?img=8'], intro: '이벤트 기획부터 진행까지 올인원', price: 550000, experience: 11, tags: ['서울/경기', '올인원', '기획력있는'], available: true },
  { id: '33', name: '원서율', category: 'MC', role: '사회자', region: '전라', rating: 4.9, reviews: 97, pudding: 33, image: 'https://i.pravatar.cc/300?img=34', images: ['https://i.pravatar.cc/300?img=34', 'https://i.pravatar.cc/200?img=9', 'https://i.pravatar.cc/200?img=10'], intro: '광주 전남 최고 인기 사회자', price: 370000, experience: 10, tags: ['전라권', '인기MC', '활기찬'], available: true },
  { id: '34', name: '피수정', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, pudding: 34, image: 'https://i.pravatar.cc/300?img=35', images: ['https://i.pravatar.cc/300?img=35', 'https://i.pravatar.cc/200?img=11', 'https://i.pravatar.cc/200?img=12'], intro: '클래식한 정통 웨딩 MC', price: 480000, experience: 14, tags: ['서울/경기', '클래식한', '정통파'], available: false },
  { id: '35', name: '차은우', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 66, pudding: 35, image: 'https://i.pravatar.cc/300?img=36', images: ['https://i.pravatar.cc/300?img=36', 'https://i.pravatar.cc/200?img=13', 'https://i.pravatar.cc/200?img=14'], intro: '남성 사회자 중 최고의 선택', price: 500000, experience: 8, tags: ['전국가능', '댄디한', '카리스마'], available: true },
  { id: '36', name: '백다솜', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 31, pudding: 36, image: 'https://i.pravatar.cc/300?img=37', images: ['https://i.pravatar.cc/300?img=37', 'https://i.pravatar.cc/200?img=15', 'https://i.pravatar.cc/200?img=16'], intro: '소박하고 진심 어린 웨딩 진행', price: 300000, experience: 3, tags: ['서울/경기', '소박한', '진심어린'], available: true },
  { id: '37', name: '공하린', category: 'MC', role: '사회자', region: '강원', rating: 4.7, reviews: 39, pudding: 37, image: 'https://i.pravatar.cc/300?img=38', images: ['https://i.pravatar.cc/300?img=38', 'https://i.pravatar.cc/200?img=17', 'https://i.pravatar.cc/200?img=18'], intro: '강원도 자연 속 웨딩 전문', price: 350000, experience: 5, tags: ['강원권', '자연스러운', '편안한'], available: true },
  { id: '38', name: '양미래', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 113, pudding: 38, image: 'https://i.pravatar.cc/300?img=39', images: ['https://i.pravatar.cc/300?img=39', 'https://i.pravatar.cc/200?img=19', 'https://i.pravatar.cc/200?img=20'], intro: '유튜버 출신 재치 만점 MC', price: 580000, experience: 6, tags: ['서울/경기', '유튜버출신', '재치있는'], available: true },
  { id: '39', name: '도연수', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 79, pudding: 39, image: 'https://i.pravatar.cc/300?img=40', images: ['https://i.pravatar.cc/300?img=40', 'https://i.pravatar.cc/200?img=21', 'https://i.pravatar.cc/200?img=22'], intro: '기업 세미나·컨퍼런스 전문 MC', price: 700000, experience: 16, tags: ['전국가능', '기업행사전문', '프로페셔널'], available: true },
  { id: '40', name: '진하은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 19, pudding: 40, image: 'https://i.pravatar.cc/300?img=41', images: ['https://i.pravatar.cc/300?img=41', 'https://i.pravatar.cc/200?img=23', 'https://i.pravatar.cc/200?img=24'], intro: '신입이지만 열정 가득한 MC', price: 250000, experience: 1, tags: ['서울/경기', '열정적인', '신선한'], available: true },
  { id: '41', name: '나윤서', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 91, pudding: 41, image: 'https://i.pravatar.cc/300?img=42', images: ['https://i.pravatar.cc/300?img=42', 'https://i.pravatar.cc/200?img=25', 'https://i.pravatar.cc/200?img=26'], intro: '고품격 하우스웨딩 전문 MC', price: 530000, experience: 12, tags: ['서울/경기', '고품격', '하우스웨딩전문'], available: true },
  { id: '42', name: '채아린', category: 'MC', role: '사회자', region: '경상', rating: 4.7, reviews: 52, pudding: 42, image: 'https://i.pravatar.cc/300?img=43', images: ['https://i.pravatar.cc/300?img=43', 'https://i.pravatar.cc/200?img=27', 'https://i.pravatar.cc/200?img=28'], intro: '창원 김해 지역 밀착 웨딩 MC', price: 360000, experience: 7, tags: ['경상권', '밀착형', '꼼꼼한'], available: true },
  { id: '43', name: '민서영', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 135, pudding: 43, image: 'https://i.pravatar.cc/300?img=44', images: ['https://i.pravatar.cc/300?img=44', 'https://i.pravatar.cc/200?img=29', 'https://i.pravatar.cc/200?img=30'], intro: '중국어 가능 국제행사 MC', price: 650000, experience: 10, tags: ['전국가능', '중국어가능', '국제행사전문'], available: false },
  { id: '44', name: '라예진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 36, pudding: 44, image: 'https://i.pravatar.cc/300?img=45', images: ['https://i.pravatar.cc/300?img=45', 'https://i.pravatar.cc/200?img=31', 'https://i.pravatar.cc/200?img=32'], intro: '달콤하고 로맨틱한 웨딩 진행', price: 400000, experience: 5, tags: ['서울/경기', '로맨틱한', '달콤한'], available: true },
  { id: '45', name: '추은별', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 68, pudding: 45, image: 'https://i.pravatar.cc/300?img=46', images: ['https://i.pravatar.cc/300?img=46', 'https://i.pravatar.cc/200?img=33', 'https://i.pravatar.cc/200?img=34'], intro: '별처럼 빛나는 당신의 웨딩 파트너', price: 470000, experience: 8, tags: ['서울/경기', '빛나는', '파트너형'], available: true },
  { id: '46', name: '곽수민', category: 'MC', role: '사회자', region: '충청', rating: 4.7, reviews: 44, pudding: 46, image: 'https://i.pravatar.cc/300?img=47', images: ['https://i.pravatar.cc/300?img=47', 'https://i.pravatar.cc/200?img=35', 'https://i.pravatar.cc/200?img=36'], intro: '청주 충북 지역 사회자', price: 340000, experience: 6, tags: ['충청권', '성실한', '믿음직한'], available: true },
  { id: '47', name: '허다빈', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 167, pudding: 47, image: 'https://i.pravatar.cc/300?img=48', images: ['https://i.pravatar.cc/300?img=48', 'https://i.pravatar.cc/200?img=37', 'https://i.pravatar.cc/200?img=38'], intro: '예능감 넘치는 웨딩 엔터테이너', price: 550000, experience: 13, tags: ['서울/경기', '예능감', '엔터테이너'], available: true },
  { id: '48', name: '성유진', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 84, pudding: 48, image: 'https://i.pravatar.cc/300?img=49', images: ['https://i.pravatar.cc/300?img=49', 'https://i.pravatar.cc/200?img=39', 'https://i.pravatar.cc/200?img=40'], intro: '종교행사 전문 격식 MC', price: 450000, experience: 15, tags: ['전국가능', '종교행사전문', '경건한'], available: true },
  { id: '49', name: '마은채', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 25, pudding: 49, image: 'https://i.pravatar.cc/300?img=50', images: ['https://i.pravatar.cc/300?img=50', 'https://i.pravatar.cc/200?img=41', 'https://i.pravatar.cc/200?img=42'], intro: '가든웨딩 전문 내추럴 MC', price: 380000, experience: 4, tags: ['서울/경기', '내추럴', '가든웨딩전문'], available: true },
  { id: '50', name: '소지안', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 121, pudding: 50, image: 'https://i.pravatar.cc/300?img=51', images: ['https://i.pravatar.cc/300?img=51', 'https://i.pravatar.cc/200?img=43', 'https://i.pravatar.cc/200?img=44'], intro: '일본어 가능 다국어 MC', price: 620000, experience: 9, tags: ['전국가능', '일본어가능', '다국어MC'], available: true },
  { id: '51', name: '주하연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 57, pudding: 51, image: 'https://i.pravatar.cc/300?img=52', images: ['https://i.pravatar.cc/300?img=52', 'https://i.pravatar.cc/200?img=45', 'https://i.pravatar.cc/200?img=46'], intro: '스몰웨딩 맞춤 아늑한 진행', price: 320000, experience: 5, tags: ['서울/경기', '스몰웨딩전문', '아늑한'], available: true },
  { id: '52', name: '변다영', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 74, pudding: 52, image: 'https://i.pravatar.cc/300?img=53', images: ['https://i.pravatar.cc/300?img=53', 'https://i.pravatar.cc/200?img=47', 'https://i.pravatar.cc/200?img=48'], intro: '포항 경주 지역 웨딩 MC', price: 350000, experience: 8, tags: ['경상권', '정감있는', '따뜻한'], available: false },
  { id: '53', name: '왕소은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 103, pudding: 53, image: 'https://i.pravatar.cc/300?img=54', images: ['https://i.pravatar.cc/300?img=54', 'https://i.pravatar.cc/200?img=49', 'https://i.pravatar.cc/200?img=50'], intro: '럭셔리 호텔 웨딩 전문가', price: 750000, experience: 18, tags: ['서울/경기', '럭셔리', '호텔웨딩전문'], available: true },
  { id: '54', name: '탁가은', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 33, pudding: 54, image: 'https://i.pravatar.cc/300?img=55', images: ['https://i.pravatar.cc/300?img=55', 'https://i.pravatar.cc/200?img=51', 'https://i.pravatar.cc/200?img=52'], intro: '축제·페스티벌 전문 MC', price: 500000, experience: 7, tags: ['전국가능', '축제전문', '흥넘치는'], available: true },
  { id: '55', name: '방서윤', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 62, pudding: 55, image: 'https://i.pravatar.cc/300?img=56', images: ['https://i.pravatar.cc/300?img=56', 'https://i.pravatar.cc/200?img=53', 'https://i.pravatar.cc/200?img=54'], intro: '모던하고 세련된 웨딩 진행', price: 490000, experience: 10, tags: ['서울/경기', '모던한', '세련된'], available: true },
  { id: '56', name: '엄지수', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 47, pudding: 56, image: 'https://i.pravatar.cc/300?img=57', images: ['https://i.pravatar.cc/300?img=57', 'https://i.pravatar.cc/200?img=55', 'https://i.pravatar.cc/200?img=56'], intro: '전주 익산 지역 웨딩 전문', price: 340000, experience: 6, tags: ['전라권', '정겨운', '친근한'], available: true },
  { id: '57', name: '금하율', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 149, pudding: 57, image: 'https://i.pravatar.cc/300?img=58', images: ['https://i.pravatar.cc/300?img=58', 'https://i.pravatar.cc/200?img=57', 'https://i.pravatar.cc/200?img=58'], intro: '아나운서 경력 10년의 정통파', price: 600000, experience: 19, tags: ['서울/경기', '아나운서출신', '정통파'], available: true },
  { id: '58', name: '석다현', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 81, pudding: 58, image: 'https://i.pravatar.cc/300?img=59', images: ['https://i.pravatar.cc/300?img=59', 'https://i.pravatar.cc/200?img=59', 'https://i.pravatar.cc/200?img=60'], intro: '감동 스토리텔링 웨딩 MC', price: 520000, experience: 11, tags: ['전국가능', '스토리텔링', '감동적인'], available: true },
  { id: '59', name: '봉유나', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 18, pudding: 59, image: 'https://i.pravatar.cc/300?img=60', images: ['https://i.pravatar.cc/300?img=60', 'https://i.pravatar.cc/200?img=61', 'https://i.pravatar.cc/200?img=62'], intro: '귀여운 매력의 돌잔치 전문', price: 280000, experience: 2, tags: ['서울/경기', '귀여운', '돌잔치전문'], available: true },
  { id: '60', name: '선가영', category: 'MC', role: '사회자', region: '경상', rating: 4.7, reviews: 53, pudding: 60, image: 'https://i.pravatar.cc/300?img=61', images: ['https://i.pravatar.cc/300?img=61', 'https://i.pravatar.cc/200?img=63', 'https://i.pravatar.cc/200?img=64'], intro: '부산 해운대 웨딩홀 전문 MC', price: 400000, experience: 9, tags: ['경상권', '해운대전문', '활발한'], available: true },
  { id: '61', name: '옥채은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 70, pudding: 61, image: 'https://i.pravatar.cc/300?img=62', images: ['https://i.pravatar.cc/300?img=62', 'https://i.pravatar.cc/200?img=65', 'https://i.pravatar.cc/200?img=66'], intro: '포토웨딩·브라이덜샤워 MC', price: 430000, experience: 7, tags: ['서울/경기', '포토웨딩전문', '감각적인'], available: true },
  { id: '62', name: '주보라', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 195, pudding: 62, image: 'https://i.pravatar.cc/300?img=63', images: ['https://i.pravatar.cc/300?img=63', 'https://i.pravatar.cc/200?img=67', 'https://i.pravatar.cc/200?img=68'], intro: '20년 경력 최고의 웨딩 마스터', price: 900000, experience: 20, tags: ['전국가능', '웨딩마스터', '최고경력'], available: true },
  { id: '63', name: '빈세아', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 28, pudding: 63, image: 'https://i.pravatar.cc/300?img=64', images: ['https://i.pravatar.cc/300?img=64', 'https://i.pravatar.cc/200?img=69', 'https://i.pravatar.cc/200?img=70'], intro: '힙하고 개성 있는 MZ 웨딩', price: 370000, experience: 3, tags: ['서울/경기', '힙한', '개성있는'], available: true },
  { id: '64', name: '예다솜', category: 'MC', role: '사회자', region: '충청', rating: 4.7, reviews: 42, pudding: 64, image: 'https://i.pravatar.cc/300?img=65', images: ['https://i.pravatar.cc/300?img=65', 'https://i.pravatar.cc/200?img=1', 'https://i.pravatar.cc/200?img=2'], intro: '천안 아산 지역 전문 MC', price: 330000, experience: 5, tags: ['충청권', '지역밀착', '꼼꼼한'], available: true },
  { id: '65', name: '편서하', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 126, pudding: 65, image: 'https://i.pravatar.cc/300?img=66', images: ['https://i.pravatar.cc/300?img=66', 'https://i.pravatar.cc/200?img=3', 'https://i.pravatar.cc/200?img=4'], intro: '뮤지컬 배우 출신 감성 MC', price: 580000, experience: 8, tags: ['서울/경기', '뮤지컬배우출신', '감성적인'], available: false },
  { id: '66', name: '복예원', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 77, pudding: 66, image: 'https://i.pravatar.cc/300?img=67', images: ['https://i.pravatar.cc/300?img=67', 'https://i.pravatar.cc/200?img=5', 'https://i.pravatar.cc/200?img=6'], intro: '워크숍·MT 전문 레크리에이션 MC', price: 450000, experience: 10, tags: ['전국가능', '레크리에이션', '신나는'], available: true },
  { id: '67', name: '탁서현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 49, pudding: 67, image: 'https://i.pravatar.cc/300?img=68', images: ['https://i.pravatar.cc/300?img=68', 'https://i.pravatar.cc/200?img=7', 'https://i.pravatar.cc/200?img=8'], intro: '차분하고 지적인 진행 스타일', price: 470000, experience: 9, tags: ['서울/경기', '지적인', '차분한'], available: true },
  { id: '68', name: '국하윤', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 64, pudding: 68, image: 'https://i.pravatar.cc/300?img=69', images: ['https://i.pravatar.cc/300?img=69', 'https://i.pravatar.cc/200?img=9', 'https://i.pravatar.cc/200?img=10'], intro: '경주 불국사 전통혼례 전문', price: 400000, experience: 12, tags: ['경상권', '전통혼례전문', '고풍스러운'], available: true },
  { id: '69', name: '온다연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 35, pudding: 69, image: 'https://i.pravatar.cc/300?img=70', images: ['https://i.pravatar.cc/300?img=70', 'https://i.pravatar.cc/200?img=11', 'https://i.pravatar.cc/200?img=12'], intro: '상견례·약혼식 전문 사회자', price: 350000, experience: 4, tags: ['서울/경기', '상견례전문', '예의바른'], available: true },
  { id: '70', name: '견아영', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 138, pudding: 70, image: 'https://i.pravatar.cc/300?img=1', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/200?img=13', 'https://i.pravatar.cc/200?img=14'], intro: '한국어·영어 완벽 이중언어 MC', price: 680000, experience: 14, tags: ['전국가능', '이중언어', '글로벌'], available: true },
  { id: '71', name: '라서진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 56, pudding: 71, image: 'https://i.pravatar.cc/300?img=2', images: ['https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/200?img=15', 'https://i.pravatar.cc/200?img=16'], intro: '웨딩플래너 겸 사회자', price: 500000, experience: 11, tags: ['서울/경기', '웨딩플래너겸', '올인원'], available: true },
  { id: '72', name: '매수아', category: 'MC', role: '사회자', region: '제주', rating: 4.8, reviews: 45, pudding: 72, image: 'https://i.pravatar.cc/300?img=3', images: ['https://i.pravatar.cc/300?img=3', 'https://i.pravatar.cc/200?img=17', 'https://i.pravatar.cc/200?img=18'], intro: '제주 리조트웨딩 전문 MC', price: 480000, experience: 7, tags: ['제주', '리조트웨딩전문', '낭만적인'], available: true },
  { id: '73', name: '빈나은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 99, pudding: 73, image: 'https://i.pravatar.cc/300?img=4', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/200?img=19', 'https://i.pravatar.cc/200?img=20'], intro: '웃음보 터지는 유쾌한 MC', price: 440000, experience: 8, tags: ['서울/경기', '유쾌한', '웃음가득'], available: true },
  { id: '74', name: '길수현', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 30, pudding: 74, image: 'https://i.pravatar.cc/300?img=5', images: ['https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/200?img=21', 'https://i.pravatar.cc/200?img=22'], intro: '군부대 행사 전문 MC', price: 350000, experience: 6, tags: ['전국가능', '군행사전문', '씩씩한'], available: true },
  { id: '75', name: '표다인', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 87, pudding: 75, image: 'https://i.pravatar.cc/300?img=6', images: ['https://i.pravatar.cc/300?img=6', 'https://i.pravatar.cc/200?img=23', 'https://i.pravatar.cc/200?img=24'], intro: '연예계 시상식 출신 MC', price: 650000, experience: 15, tags: ['서울/경기', '시상식출신', '화려한'], available: false },
  { id: '76', name: '제윤아', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 40, pudding: 76, image: 'https://i.pravatar.cc/300?img=7', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/200?img=25', 'https://i.pravatar.cc/200?img=26'], intro: '목포 여수 남도 웨딩 MC', price: 330000, experience: 5, tags: ['전라권', '남도감성', '다정한'], available: true },
  { id: '77', name: '옥서율', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 115, pudding: 77, image: 'https://i.pravatar.cc/300?img=8', images: ['https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/200?img=27', 'https://i.pravatar.cc/200?img=28'], intro: '신부 대기실부터 함께하는 밀착 MC', price: 520000, experience: 13, tags: ['서울/경기', '밀착케어', '꼼꼼한'], available: true },
  { id: '78', name: '인보미', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 72, pudding: 78, image: 'https://i.pravatar.cc/300?img=9', images: ['https://i.pravatar.cc/300?img=9', 'https://i.pravatar.cc/200?img=29', 'https://i.pravatar.cc/200?img=30'], intro: '학교 행사·졸업식 전문 MC', price: 300000, experience: 7, tags: ['전국가능', '학교행사전문', '활기찬'], available: true },
  { id: '79', name: '태수연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, pudding: 79, image: 'https://i.pravatar.cc/300?img=10', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/200?img=31', 'https://i.pravatar.cc/200?img=32'], intro: '품격 있는 약혼식·상견례 전문', price: 420000, experience: 9, tags: ['서울/경기', '품격있는', '약혼식전문'], available: true },
  { id: '80', name: '선예나', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 160, pudding: 80, image: 'https://i.pravatar.cc/300?img=11', images: ['https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/200?img=33', 'https://i.pravatar.cc/200?img=34'], intro: '대한민국 웨딩 MC 어워드 수상자', price: 850000, experience: 21, tags: ['서울/경기', '어워드수상', '최고급'], available: true },
];

interface ReviewItem {
  nickname: string;
  avatar: string;
  rating: number;
  text: string;
}

const RANK_REVIEWS: Record<string, ReviewItem[]> = {
  '1': [
    { nickname: '행복한신부', avatar: 'https://i.pravatar.cc/40?img=31', rating: 5.0, text: '우아하면서도 위트 있는 진행 덕분에 하객들이 모두 즐거워했어요' },
    { nickname: '웨딩준비중', avatar: 'https://i.pravatar.cc/40?img=32', rating: 5.0, text: '격식과 유머의 밸런스가 완벽했어요. 다음에도 꼭 부탁드릴게요' },
    { nickname: '예비신랑J', avatar: 'https://i.pravatar.cc/40?img=33', rating: 5.0, text: '사전 미팅부터 꼼꼼하게 준비해주셔서 감동이었습니다' },
  ],
  '2': [
    { nickname: '봄날의신부', avatar: 'https://i.pravatar.cc/40?img=34', rating: 5.0, text: '감동과 웃음을 동시에, 이분 없으면 우리 결혼식 상상이 안 돼요' },
    { nickname: '하객대표', avatar: 'https://i.pravatar.cc/40?img=35', rating: 4.9, text: '하객으로 갔는데 MC분이 너무 좋아서 연락처 받아왔어요' },
    { nickname: '감동그자체', avatar: 'https://i.pravatar.cc/40?img=36', rating: 5.0, text: '부모님 감사 편지 낭독 때 온 하객이 울었어요. 진행력 최고' },
  ],
  '3': [
    { nickname: '차분한예신', avatar: 'https://i.pravatar.cc/40?img=37', rating: 5.0, text: '섬세하게 챙겨주셔서 긴장 하나도 안 했어요. 최고의 MC!' },
    { nickname: '후기남기기', avatar: 'https://i.pravatar.cc/40?img=38', rating: 4.8, text: '소통이 정말 빠르고 세심해요. 리허설도 꼼꼼하게 진행' },
    { nickname: '행복한우리', avatar: 'https://i.pravatar.cc/40?img=39', rating: 5.0, text: '자연스러운 분위기 연출이 정말 프로페셔널했습니다' },
  ],
  '4': [
    { nickname: '유쾌한커플', avatar: 'https://i.pravatar.cc/40?img=40', rating: 5.0, text: '격식도 있으면서 유쾌해서 분위기가 정말 좋았습니다' },
    { nickname: '만족100', avatar: 'https://i.pravatar.cc/40?img=41', rating: 4.9, text: '이벤트 아이디어도 직접 제안해주시고 진행도 깔끔!' },
    { nickname: '결혼축하', avatar: 'https://i.pravatar.cc/40?img=42', rating: 5.0, text: '친구 결혼식에서 보고 반해서 저도 바로 예약했어요' },
  ],
  '5': [
    { nickname: '따뜻한하루', avatar: 'https://i.pravatar.cc/40?img=43', rating: 4.8, text: '따뜻한 목소리에 하객분들이 다 감동받으셨어요' },
    { nickname: '소소한행복', avatar: 'https://i.pravatar.cc/40?img=44', rating: 4.9, text: '스몰웨딩이었는데 오히려 더 친밀한 진행이 좋았어요' },
    { nickname: '웨딩후기', avatar: 'https://i.pravatar.cc/40?img=45', rating: 5.0, text: '목소리 톤이 정말 좋으세요. 편안한 분위기를 만들어주셨어요' },
  ],
};

function RotatingReview({ proId }: { proId: string }) {
  const reviews = RANK_REVIEWS[proId] ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [reviews.length]);

  if (reviews.length === 0) return null;
  const review = reviews[idx];

  return (
    <div className="relative h-[52px] overflow-hidden">
      <div
        key={idx}
        className="absolute inset-0 animate-review-fade"
      >
        <div className="flex items-center gap-1 mb-1">
          <img src={review.avatar} alt="" className="w-[14px] h-[14px] rounded-full" />
          <span className="text-[10px] font-semibold text-gray-700">{review.nickname}</span>
          <Star size={9} className="fill-yellow-400 text-yellow-400 ml-0.5" />
          <span className="text-[10px] font-bold text-gray-600">{review.rating}</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
          {review.text}
        </p>
      </div>
    </div>
  );
}

// Language map for foreign-language capable pros
const PRO_LANGUAGES: Record<string, string[]> = {
  '19': ['영어'],
  '39': ['영어'],
  '43': ['중국어'],
  '50': ['일본어'],
  '70': ['영어'],
  '23': ['영어', '일본어'],
  '30': ['영어', '중국어'],
  '10': ['영어'],
};

const LANGUAGE_PROS_IDS = Object.keys(PRO_LANGUAGES);
const ALL_LANGUAGES = [...new Set(Object.values(PRO_LANGUAGES).flat())];

// 언어별 국기 매핑
const LANGUAGE_FLAGS: Record<string, string> = {
  '영어': '/images/🇬🇧 깃발_ 영국.svg',
  '일본어': '/images/🇯🇵 깃발_ 일본.svg',
  '중국어': '/images/🇨🇳 깃발_ 중국.svg',
  '베트남어': '/images/🇻🇳 깃발_ 베트남.svg',
};

// Event-specialist pros (by id)
const EVENT_SPECIALIST: Record<string, string> = {
  '14': '돌잔치', '59': '돌잔치',
  '26': '생신잔치',
  '13': '기업행사', '39': '기업행사',
  '29': '야외웨딩', '72': '리조트웨딩',
  '48': '종교행사',
  '78': '학교행사',
  '68': '전통혼례',
  '69': '상견례',
  '66': '워크숍/MT',
  '54': '축제/페스티벌',
};
const EVENT_SPECIALIST_IDS = Object.keys(EVENT_SPECIALIST);
const ALL_EVENT_TYPES = [...new Set(Object.values(EVENT_SPECIALIST))];

// Online status: minutes since last active (0 = currently online)
const PRO_ONLINE_STATUS: Record<string, number> = {
  '1': 0, '2': 0, '4': 3, '6': 0, '7': 0, '8': 2,
  '9': 0, '16': 0, '20': 1, '22': 0, '25': 0, '28': 3,
  '31': 0, '33': 0, '38': 2, '41': 0, '45': 0, '47': 0,
  '49': 1, '51': 0, '55': 0, '60': 3, '61': 0, '73': 0,
};

function OnlineProCard({ pro }: { pro: typeof MOCK_PROS[0] }) {
  const minutesAgo = PRO_ONLINE_STATUS[pro.id] ?? 0;
  const isNow = minutesAgo === 0;

  return (
    <Link
      href={`/pros/${pro.id}`}
      className="flex items-center gap-4 group p-[10px] rounded-[14px] active:bg-black/5 active:scale-[0.97] transition-all duration-200"
    >
      {/* Circle avatar with fan-out on hover */}
      <div className="relative w-[100px] h-[100px] shrink-0 my-3 z-10">
        {/* Stacked photos behind — fan out on hover */}
        <img
          src={pro.images[2]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-full object-cover border-[3px] border-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[64px] group-hover:translate-y-[-12px] group-hover:rotate-[12deg] group-hover:scale-90 z-[1]"
        />
        <img
          src={pro.images[1]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-full object-cover border-[3px] border-white shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-[50ms] group-hover:translate-x-[34px] group-hover:translate-y-[-18px] group-hover:rotate-[6deg] group-hover:scale-95 z-[2]"
        />
        {/* Main photo — stays in place */}
        <img
          src={pro.images[0]}
          alt={pro.name}
          className="absolute w-[100px] h-[100px] rounded-full object-cover border-[3px] border-white shadow-lg z-[3] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        />
        {/* Online indicator */}
        <span className={`absolute bottom-1 right-1 z-[4] w-4 h-4 rounded-full border-[3px] border-white ${isNow ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      {/* Info */}
      <div className="min-w-0">
        <span className="text-[12px] font-medium text-gray-400">{pro.category}</span>
        <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">{pro.name}</p>
        <p className="text-[12px] mt-1">
          {isNow ? (
            <span className="text-green-600 font-semibold">현재 접속중</span>
          ) : (
            <span className="text-gray-400">접속 {minutesAgo}분 전</span>
          )}
        </p>
      </div>
    </Link>
  );
}

// ─── Business Partners (기업회원) ──────────────────────────────
interface BusinessPartner {
  id: string;
  category: string;
  name: string;
  location: string;
  images: string[];
  tags: string[];
  originalPrice: number;
  discountPercent: number;
}

const BIZ_CATEGORIES = ['전체', '웨딩홀', '피부과', '스튜디오', '드레스', '헤메샵', '스냅영상'];

const MOCK_BUSINESSES: BusinessPartner[] = [
  { id: 'b1', category: '웨딩홀', name: '더채플앳청담', location: '서울 강남구', images: ['https://i.pravatar.cc/300?img=50', 'https://i.pravatar.cc/300?img=51', 'https://i.pravatar.cc/300?img=52'], tags: ['우아한', '모던한', '루프탑'], originalPrice: 5000000, discountPercent: 40 },
  { id: 'b2', category: '웨딩홀', name: '그랜드하얏트 서울', location: '서울 용산구', images: ['https://i.pravatar.cc/300?img=53', 'https://i.pravatar.cc/300?img=54', 'https://i.pravatar.cc/300?img=55'], tags: ['럭셔리', '호텔', '대규모'], originalPrice: 8000000, discountPercent: 35 },
  { id: 'b3', category: '피부과', name: '글로우업 피부과', location: '서울 신사동', images: ['https://i.pravatar.cc/300?img=56', 'https://i.pravatar.cc/300?img=57', 'https://i.pravatar.cc/300?img=58'], tags: ['웨딩피부', '관리전문', '인기'], originalPrice: 1200000, discountPercent: 50 },
  { id: 'b4', category: '피부과', name: '뉴페이스 클리닉', location: '서울 압구정', images: ['https://i.pravatar.cc/300?img=59', 'https://i.pravatar.cc/300?img=60', 'https://i.pravatar.cc/300?img=61'], tags: ['프리미엄', '1:1맞춤', '피부톤업'], originalPrice: 1500000, discountPercent: 45 },
  { id: 'b5', category: '스튜디오', name: '무드스튜디오', location: '서울 성수동', images: ['https://i.pravatar.cc/300?img=62', 'https://i.pravatar.cc/300?img=63', 'https://i.pravatar.cc/300?img=64'], tags: ['감성적인', '자연광', '트렌디'], originalPrice: 2000000, discountPercent: 40 },
  { id: 'b6', category: '스튜디오', name: '아뜰리에드서울', location: '서울 삼청동', images: ['https://i.pravatar.cc/300?img=65', 'https://i.pravatar.cc/300?img=66', 'https://i.pravatar.cc/300?img=67'], tags: ['클래식', '고급스러운', '한옥배경'], originalPrice: 2500000, discountPercent: 35 },
  { id: 'b7', category: '드레스', name: '라비엔로즈', location: '서울 논현동', images: ['https://i.pravatar.cc/300?img=68', 'https://i.pravatar.cc/300?img=69', 'https://i.pravatar.cc/300?img=70'], tags: ['수입드레스', '맞춤제작', '우아한'], originalPrice: 3000000, discountPercent: 30 },
  { id: 'b8', category: '드레스', name: '모니카블랑쉬', location: '서울 청담동', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/300?img=3'], tags: ['디자이너', '프리미엄', '트렌디'], originalPrice: 4000000, discountPercent: 25 },
  { id: 'b9', category: '헤메샵', name: '블룸헤어메이크업', location: '서울 강남구', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/300?img=6'], tags: ['자연스러운', '지속력', '본식전문'], originalPrice: 800000, discountPercent: 40 },
  { id: 'b10', category: '헤메샵', name: '뷰티하우스 제이', location: '서울 서초구', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/300?img=9'], tags: ['셀럽담당', '꼼꼼한', '리터치포함'], originalPrice: 1000000, discountPercent: 35 },
  { id: 'b11', category: '스냅영상', name: '필름바이준', location: '서울 마포구', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/300?img=12'], tags: ['시네마틱', '감성영상', '당일편집'], originalPrice: 1500000, discountPercent: 40 },
  { id: 'b12', category: '스냅영상', name: '스냅바이유', location: '서울 합정동', images: ['https://i.pravatar.cc/300?img=13', 'https://i.pravatar.cc/300?img=14', 'https://i.pravatar.cc/300?img=15'], tags: ['자연스러운', '포토+영상', '인기'], originalPrice: 1200000, discountPercent: 45 },
];

function BusinessCard({ biz }: { biz: BusinessPartner }) {
  const [expanded, setExpanded] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => setExpanded(true), 400);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const discountedPrice = biz.originalPrice * (1 - biz.discountPercent / 100);

  return (
    <Link
      href={`/businesses/${biz.id}`}
      className="flex gap-4 group"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onTouchStart={startPress}
      onTouchEnd={endPress}
    >
      {/* Left — Stacked square images that fan out */}
      <div className="relative w-[100px] h-[100px] shrink-0 my-2">
        <img
          src={biz.images[2]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-sm z-[1] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={expanded ? { transform: 'translateX(60px) translateY(-6px) rotate(8deg) scale(0.88)' } : {}}
        />
        <img
          src={biz.images[1]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-sm z-[2] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-[30ms]"
          style={expanded ? { transform: 'translateX(32px) translateY(-10px) rotate(4deg) scale(0.94)' } : {}}
        />
        <img
          src={biz.images[0]}
          alt={biz.name}
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-md z-[3] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={expanded ? { transform: 'scale(1.03)' } : {}}
        />
      </div>

      {/* Right — Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        {/* Category + Name */}
        <span className="text-[11px] font-medium text-primary-500">{biz.category}</span>
        <p className="text-[16px] font-bold text-gray-900 leading-tight mt-0.5 truncate">{biz.name}</p>

        {/* Location */}
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin size={11} className="text-gray-400" />
          <span className="text-[12px] text-gray-400">{biz.location}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {biz.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Price + Coupon */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] text-gray-400 line-through">{(biz.originalPrice / 10000).toFixed(0)}만원</span>
          <span className="text-[14px] font-black text-primary-500">{biz.discountPercent}%</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Gift size={11} className="text-primary-400" />
          <span className="text-[10px] text-primary-500 font-medium">회원가입 + 설문 답변 시 {biz.discountPercent}% 할인 쿠폰 증정</span>
        </div>
      </div>
    </Link>
  );
}

const HERO_CATEGORIES = [
  { name: 'MC·사회자', emoji: '🎤', badge: '인기' },
  { name: '축가', emoji: '🎵' },
  { name: '연주', emoji: '🎹' },
  { name: '쇼호스트', emoji: '📺' },
  { name: '웨딩홀', emoji: '💒', badge: '업종별' },
  { name: '스튜디오', emoji: '📷', badge: '업종별' },
  { name: '드레스', emoji: '👗' },
  { name: '헤어·메이크업', emoji: '💄' },
  { name: 'AI 매칭', emoji: '✨', badge: 'Best' },
  { name: '전체보기', emoji: '⊞' },
];

const BANNERS = [
  { id: 'b1', title: '당신의 특별한 날,\n완벽한 전문가를 만나세요', subtitle: 'Wedding Professionals', bgColor: 'bg-gradient-to-br from-primary-500 via-primary-500 to-primary-600' },
  { id: 'b2', title: '지금 견적 요청하면\n최대 30% 할인', subtitle: 'Special Offer', bgColor: 'bg-gradient-to-br from-violet-500 via-violet-500 to-purple-600' },
  { id: 'b3', title: 'AI가 추천하는\n나에게 딱 맞는 전문가', subtitle: 'AI Matching', bgColor: 'bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600' },
  { id: 'b4', title: '후기 작성하고\n푸딩 포인트 받아가세요', subtitle: 'Review Event', bgColor: 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600' },
];

const CATEGORIES = ['전체', 'MC', '가수', '쇼호스트'];
const EVENTS = ['결혼식', '돌잔치', '생신잔치', '기업행사', '강의/클래스'];

const MOBILE_CATEGORY_TABS = ['모두', '결혼식사회자', '관공서 행사', '컨퍼런스/세미나', '체육대회'];

const EVENT_PACKAGES = [
  { name: '라이브커머스', color: 'bg-rose-500', icon: '🛒' },
  { name: '공식행사', color: 'bg-blue-600', icon: '🏛️' },
  { name: '송년회', color: 'bg-amber-500', icon: '🎉' },
  { name: '워크숍', color: 'bg-emerald-500', icon: '📋' },
  { name: '팀빌딩', color: 'bg-violet-500', icon: '🤝' },
  { name: '레크리에이션', color: 'bg-orange-500', icon: '🎯' },
  { name: '체육대회', color: 'bg-cyan-500', icon: '🏅' },
  { name: '기업PT', color: 'bg-indigo-500', icon: '📊' },
  { name: '세미나', color: 'bg-pink-500', icon: '🎓' },
];


function ProCard({ pro, favorites, toggleFavorite, index, languages }: {
  pro: typeof MOCK_PROS[0];
  favorites: Set<string>;
  toggleFavorite: (e: React.MouseEvent, id: string) => void;
  index: number;
  languages?: string[];
}) {
  return (
    <Link
      href={`/pros/${pro.id}`}
      className="block opacity-0 animate-fade-in group card-press"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
    >
      <div className="relative rounded-lg overflow-hidden">
        {/* Mobile: single 3:4 image */}
        <div className="lg:hidden" style={{ aspectRatio: '3 / 4' }}>
          <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
        </div>
        {/* Desktop: 1+2 grid layout */}
        <div className="hidden lg:grid grid-cols-[1fr_0.5fr] gap-[2px] h-[220px]">
          <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          <div className="grid grid-rows-2 gap-[2px]">
            <img src={pro.images[1]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
            <img src={pro.images[2]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          </div>
        </div>
        <button
          onClick={(e) => toggleFavorite(e, pro.id)}
          className="absolute top-2 right-2 transition-transform duration-200 active:scale-125"
        >
          {favorites.has(pro.id) ? (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="#FF4D4D"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="rgba(0,0,0,0.3)"/></svg>
          )}
        </button>
      </div>
      <div className="mt-1.5">
        <img src="/images/파트너스 뱃지.svg" alt="Partners" className="h-[22px] mb-0.5" />
        <h4 className="text-[15px] font-semibold text-gray-900 leading-tight lg:text-[16px]">{pro.role} {pro.name}</h4>
        <div className="flex items-center gap-2 mt-0.5 mb-1">
          <div className="flex items-center gap-0.5">
            <Star size={11} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[12px] font-bold text-gray-900">{pro.rating}</span>
            <span className="text-[11px] text-gray-400">({pro.reviews})</span>
          </div>
          <div className="flex items-center gap-0.5">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill="#FF4D4D"/></svg>
            <span className="text-[11px] text-gray-400">{pro.pudding || Math.floor(Math.random() * 50 + 10)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] font-bold px-1.5 rounded-[5px] bg-primary-50 text-primary-600 flex items-center" style={{ height: 22 }}>경력<CountUpText value={pro.experience} suffix="년" /></span>
          {languages && languages.map((lang) => (
            <span key={lang} className="text-[10px] font-bold px-1.5 rounded-[5px] bg-blue-50 text-blue-600 flex items-center" style={{ height: 22 }}>{lang}</span>
          ))}
          {pro.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>{tag}</span>
          ))}
          {pro.available && (
            <span className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>즉시출근</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const rankScrollRef = useRef<HTMLDivElement>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedBizCat, setSelectedBizCat] = useState<string | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(56);

  useEffect(() => {
    const onScroll = () => {
      // 약 160px 이상 스크롤하면 (결혼식사회자 버튼 영역 지나면) 로고 숨김
      setLogoVisible(window.scrollY < 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height + 12));
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  const filteredBiz = MOCK_BUSINESSES.filter((b) => !selectedBizCat || b.category === selectedBizCat);

  const toggleFavorite = (e: React.MouseEvent, proId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isAdding = !favorites.has(proId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(proId)) next.delete(proId);
      else next.add(proId);
      return next;
    });
    // Trigger fly animation when adding to favorites
    if (isAdding) {
      const pro = MOCK_PROS.find((p) => p.id === proId);
      if (pro) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        triggerFavoriteAnimation({
          imageUrl: pro.image,
          startX: rect.left + rect.width / 2,
          startY: rect.top + rect.height / 2,
        });
      }
    }
  };

  const languagePros = MOCK_PROS.filter((p) => {
    if (!LANGUAGE_PROS_IDS.includes(p.id)) return false;
    if (!selectedLang) return true;
    return PRO_LANGUAGES[p.id]?.includes(selectedLang);
  });

  const eventPros = MOCK_PROS.filter((p) => {
    if (!EVENT_SPECIALIST_IDS.includes(p.id)) return false;
    if (!selectedEventType) return true;
    return EVENT_SPECIALIST[p.id] === selectedEventType;
  });

  const regionPros = MOCK_PROS.filter((p) => {
    if (!selectedRegion) return true;
    return p.region === selectedRegion || p.region === '전국';
  });

  const onlinePros = MOCK_PROS.filter((p) => p.id in PRO_ONLINE_STATUS).slice(0, 20);

  return (
    <div className="bg-white min-h-screen w-full">
      {/* ─── Mobile Header (Fixed, single row: logo + search + bell) ── */}
      <div
        ref={headerRef}
        className="lg:hidden fixed top-0 left-0 right-0 z-30 px-[10px] pt-[12px] pb-[10px]"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Logo - shrinks & disappears on scroll */}
          <Link
            href="/home"
            className="shrink-0 origin-left"
            style={{
              width: logoVisible ? 'auto' : 0,
              opacity: logoVisible ? 1 : 0,
              transform: logoVisible ? 'scale(1)' : 'scale(0.5)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              overflow: 'hidden',
            }}
          >
            <Logo className="h-[24px] w-auto text-gray-900" />
          </Link>
          {/* Search bar - expands with bounce */}
          <Link
            href="/pros"
            className="flex items-center gap-2 bg-surface-100 rounded-full px-3 py-2.5 hover:bg-surface-200/80"
            style={{
              flex: 1,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <Search size={16} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 text-[14px] font-medium truncate">어떤 전문가를 찾으시나요?</span>
          </Link>
          {/* Bell icon */}
          <Link
            href="/notifications"
            className="relative p-2 shrink-0 rounded-full hover:bg-surface-100/80"
            style={{
              width: logoVisible ? 'auto' : 0,
              opacity: logoVisible ? 1 : 0,
              transform: logoVisible ? 'scale(1)' : 'scale(0.5)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              overflow: 'hidden',
              padding: logoVisible ? undefined : 0,
            }}
          >
            <Bell size={20} className="text-gray-700" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
          </Link>
        </div>
      </div>
      {/* Spacer for fixed header */}
      <div className="lg:hidden h-[56px]" />

      {/* ─── Mobile: CTA → Category Cards → Category Tabs → Icon Grid ─ */}
      <div className="lg:hidden">
        {/* Category cards (결혼식사회자 / 행사사회자) */}
        <div className="px-[10px] pt-3 pb-1">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pros?category=결혼식사회자"
              className="rounded-2xl bg-white border border-gray-100 shadow-sm px-3 flex items-center gap-2.5 h-[64px] opacity-0"
              style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards' }}
            >
              <img src="/images/cat-wedding-mc.png" alt="결혼식사회자" className="w-10 h-10 object-cover shrink-0" />
              <div className="leading-none">
                <span className="text-[16px] font-semibold block leading-tight" style={{ color: '#2B313D' }}>결혼식사회자</span>
                <span className="text-[12px] font-medium leading-tight" style={{ color: '#A4ABBA' }}>공인 아나운서 출신</span>
              </div>
            </Link>
            <Link
              href="/pros?category=행사사회자"
              className="rounded-2xl bg-white border border-gray-100 shadow-sm px-3 flex items-center gap-2.5 h-[64px] opacity-0"
              style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards' }}
            >
              <img src="/images/cat-event-mc.png" alt="행사사회자" className="w-10 h-10 object-cover shrink-0" />
              <div className="leading-none">
                <span className="text-[16px] font-semibold block leading-tight" style={{ color: '#2B313D' }}>행사사회자</span>
                <span className="text-[12px] font-medium leading-tight" style={{ color: '#A4ABBA' }}>B2B B2C 행사전문</span>
              </div>
            </Link>
          </div>
        </div>

        {/* 3. Category text tabs */}
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide px-[10px] py-2 opacity-0"
          style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards' }}
        >
          {['결혼식사회자', '행사 맞춤의뢰', 'MC', '기업행사', '연례행사', '체육대회', '컨퍼런스'].map((tab) => (
            <button
              key={tab}
              className="shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-[12px]"
              style={{ backgroundColor: '#F2F3F5', color: '#51535C' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 4. Icon category grid (2 rows x 4 cols) */}
        <div className="px-[10px] pb-2 pt-1">
          <div className="grid grid-cols-4 gap-y-3 gap-x-2">
            {[
              { name: '외국어사회자', img: '/images/cat-foreign-mc.png' },
              { name: '웨딩홀', img: '/images/cat-wedding-hall.png' },
              { name: '스튜디오', img: '/images/cat-studio.png' },
              { name: '피부과', img: '/images/cat-derma.png' },
              { name: '드레스', img: '/images/cat-dress.png' },
              { name: '헤메샵', img: '/images/cat-hair-makeup.png' },
              { name: '스냅·영상', img: '/images/cat-snap-video.png' },
              { name: '축가·연주', img: '/images/cat-singer.png' },
            ].map((item, i) => (
              <Link
                key={item.name}
                href={`/pros?category=${encodeURIComponent(item.name)}`}
                className="flex flex-col items-center gap-1.5 opacity-0"
                style={{ animation: `fadeScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.5 + i * 0.06}s forwards` }}
              >
                <div className="w-[52px] h-[52px] flex items-center justify-center overflow-hidden">
                  <img src={item.img} alt={item.name} className="w-full h-full object-contain" />
                </div>
                <span className="text-[12px] font-medium text-center leading-tight" style={{ color: '#51535C' }}>{item.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-2 bg-gray-50" />
      </div>

      {/* ─── Desktop Hero ────────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="flex items-center justify-between gap-16">
            <div className="flex-1 max-w-xl">
              <p className="eyebrow mb-4">WEDDING PROFESSIONALS</p>
              <h2 className="headline mb-5">
                당신의 특별한 날,<br />
                <span className="text-primary-500">완벽한 전문가</span>를 만나세요
              </h2>
              <p className="text-[16px] text-gray-500 mb-10 leading-relaxed max-w-[50ch]">
                웨딩 MC, 축가 가수, 쇼호스트까지<br />
                AI 매칭으로 딱 맞는 전문가를 추천받으세요
              </p>
              <div className="flex gap-3">
                <Link href="/match" className="btn-primary w-auto inline-flex items-center gap-2 px-8">
                  견적 요청하기 <ArrowRight size={18} />
                </Link>
                <Link href="/pros" className="btn-outline w-auto px-8">
                  전문가 둘러보기
                </Link>
              </div>
            </div>
            {/* Hero visual — Stack Banner */}
            <div className="flex-1 max-w-lg">
              <StackBanner banners={BANNERS} />
            </div>
          </div>

          {/* ─── Category Icons ─────────────────────────────────────── */}
          <div className="flex items-start justify-between mt-14 gap-2">
            {HERO_CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.name === '전체보기' ? '/pros' : `/pros?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 group w-[90px]"
              >
                <div className="relative">
                  {cat.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      cat.badge === 'Best'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-red-500 border border-red-400'
                    }`}>
                      {cat.badge}
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-surface-50 flex items-center justify-center text-[28px] group-hover:bg-surface-100 group-hover:scale-105 transition-all duration-200">
                    {cat.emoji}
                  </div>
                </div>
                <span className="text-[13px] text-gray-700 font-medium text-center leading-tight group-hover:text-gray-900 transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-[10px] lg:px-0 py-6 lg:py-12 space-y-10 lg:max-w-7xl lg:mx-auto lg:px-8">
        {/* ─── Category Chips (Desktop only) ─────────────────────────── */}
        <div className="hidden lg:flex gap-2.5 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat, i) => (
            <button key={cat} className={i === 0 ? 'chip-active' : 'chip-inactive'}>
              {cat}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. 지금 접속중인 전문가                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="section-title">지금 접속중인 전문가</h3>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              </div>
              <p className="section-subtitle mt-1">지금 바로 상담 가능한 전문가예요</p>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto overflow-y-visible scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
            {onlinePros.map((pro) => (
              <div key={pro.id} className="shrink-0">
                <OnlineProCard pro={pro} />
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. 이달의 TOP 전문가                                        */}
        {/* ══════════════════════════════════════════════��════════════ */}
        <section>
          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">🏆</span>
              <div>
                <h3 className="text-[16px] font-extrabold text-gray-900">BEST 결혼식사회자</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">가장 많이 찾았던 전문가를 한눈에</p>
              </div>
            </div>
            <Link href="/pros" className="p-1">
              <ChevronRight size={20} className="text-gray-400" />
            </Link>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-5">
            <div>
              <h3 className="section-title">이달의 TOP 전문가</h3>
              <p className="section-subtitle mt-1">리뷰와 평점으로 선정된 TOP 5</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Mobile: Pill-shaped 3:4 photos with rank badges (top 3) */}
          <div className="lg:hidden grid grid-cols-3 gap-x-3 py-4">
            {[
              { pro: MOCK_PROS[1], border: '#D1D5DB', trophy: '/images/Group 1707482188.svg', offset: true },
              { pro: MOCK_PROS[0], border: '#FBBF24', trophy: '/images/Group 1707482189.svg', offset: false },
              { pro: MOCK_PROS[2], border: '#CD7F32', trophy: '/images/Group 1707482190.svg', offset: true },
            ].map(({ pro, border, trophy, offset }) => (
              <Link key={pro.id} href={`/pros/${pro.id}`} className={`flex flex-col items-center ${offset ? 'mt-5' : ''}`}>
                <div className="relative w-full aspect-[3/4]">
                  <img
                    src={pro.image}
                    alt={pro.name}
                    className="w-full h-full object-cover shadow-md"
                    style={{ borderRadius: '9999px', border: `1.4px solid ${border}` }}
                  />
                  <img src={trophy} alt="" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[29px] h-[18px]" />
                </div>
                <p className="text-[14px] font-bold text-gray-900 mt-4">{pro.name}</p>
                <p className="text-[12px] text-gray-400">{pro.role}</p>
              </Link>
            ))}
          </div>

          {/* Desktop: horizontal scroll rank cards */}
          <div
            ref={rankScrollRef}
            className="hidden lg:flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          >
            {MOCK_PROS.slice(0, 5).map((pro, i) => (
              <Link
                key={pro.id}
                href={`/pros/${pro.id}`}
                className="flex-shrink-0 w-[280px] snap-start flex gap-3 group"
              >
                {/* Rank Number — vertically centered */}
                <div className="flex items-center shrink-0">
                  <span className="text-[36px] font-black text-gray-900 leading-none">{i + 1}</span>
                </div>

                {/* Photo 3:4 */}
                <div className="w-[80px] h-[106px] rounded-lg overflow-hidden shrink-0">
                  <img
                    src={pro.image}
                    alt={pro.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <span className="text-[11px] font-medium text-gray-400">{pro.category}</span>
                    <p className="text-[15px] font-bold text-gray-900 leading-tight">{pro.name}</p>
                  </div>
                  <RotatingReview proId={pro.id} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. 인기 전문가 — PC 5×2, Mobile 2×3                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="section-title">인기 전문가</h3>
                <p className="section-subtitle mt-1">고객 만족도가 높은 전문가를 만나보세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
          {/* Mobile: 3×3 grid, Desktop: 5×2 grid */}
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-5 lg:gap-x-4 lg:gap-y-8">
            {MOCK_PROS.slice(0, 10).map((pro, i) => (
              <div key={pro.id} className={i >= 9 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. 행사 전문가                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">행사 전문가</h3>
                <p className="section-subtitle mt-1">행사 유형별 전문 사회자를 만나보세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedEventType(null)}
                className={selectedEventType === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {ALL_EVENT_TYPES.map((et) => (
                <button
                  key={et}
                  onClick={() => setSelectedEventType(selectedEventType === et ? null : et)}
                  className={selectedEventType === et ? 'chip-active' : 'chip-inactive'}
                >
                  {et}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {/* 4개씩 묶어서 페이지 단위로 스와이프 */}
            {Array.from({ length: Math.ceil(eventPros.length / 4) }).map((_, pageIdx) => (
              <div key={pageIdx} className="flex flex-col gap-3 shrink-0 w-[calc(100%-40px)] snap-start px-1">
                {eventPros.slice(pageIdx * 4, pageIdx * 4 + 4).map((pro, i) => {
                  const reviews = [
                    '분위기를 정말 잘 살려주셔서 감동이었어요',
                    '섬세한 진행 덕분에 행사가 완벽했습니다',
                    '격식과 유머의 밸런스가 최고였어요',
                    '처음부터 끝까지 프로페셔널한 진행이었습니다',
                  ];
                  return (
                    <Link
                      key={pro.id}
                      href={`/pros/${pro.id}`}
                      className="flex gap-3 group opacity-0 animate-fade-in"
                      style={{ animationDelay: `${(pageIdx * 4 + i) * 60}ms`, animationFillMode: 'forwards' }}
                    >
                      <div className="w-[66px] h-[88px] shrink-0 rounded-lg overflow-hidden">
                        <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[16px] font-semibold text-gray-900">{pro.role} {pro.name}</h4>
                          <span className="text-[11px] text-gray-400">경력 {pro.experience}년</span>
                        </div>
                        <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">&ldquo;{reviews[i % reviews.length]}&rdquo;</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          {eventPros.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 행사 유형의 전문가가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4.5 지역별 사회자                                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="section-title">지역별 사회자</h3>
                <p className="section-subtitle mt-1">내 지역에서 바로 활동하는 전문가</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
          </Reveal>
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
            {['서울/경기', '충청', '경상', '전라', '강원', '제주'].map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                className={selectedRegion === region ? 'chip-active' : 'chip-inactive'}
              >
                {region}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-5 lg:gap-x-4 lg:gap-y-8">
            {regionPros.slice(0, 9).map((pro, i) => (
              <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
          {regionPros.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 지역의 전문가가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. 외국어 전문가                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="relative" style={{ overflow: 'visible' }}>
          {/* Spline crystal ball - 100px 위로 이동 */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0 overflow-hidden"
            style={{
              top: '-120px',
              width: '100vw',
              maxWidth: '900px',
              height: '500px',
              opacity: 0.4,
            }}
            aria-hidden="true"
          >
            <iframe
              src="https://my.spline.design/crystalball-OFag4dxCWGLMOxRxDonTbViO/"
              frameBorder="0"
              loading="lazy"
              allow="autoplay"
              scrolling="no"
              className="absolute left-1/2 top-1/2 block"
              style={{
                background: 'transparent',
                border: 'none',
                width: '200%',
                height: '200%',
                transform: 'translate(-50%, -50%) scale(0.5)',
                transformOrigin: 'center center',
              }}
              title="crystal ball"
            />
            {/* Spline 하단 → 위로 그라데이션 블러 (Spline 영역 안에서만) */}
            <div
              className="absolute left-0 right-0 bottom-0 pointer-events-none"
              style={{
                height: '70%',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0) 100%)',
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0) 100%)',
              }}
            />
          </div>
          {/* 화이트 그라데이션 - 하단으로 더 길게 */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-[5]"
            style={{
              top: '40px',
              width: '100vw',
              maxWidth: '900px',
              height: '460px',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 20%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0.95) 75%, rgba(255,255,255,1) 100%)',
            }}
            aria-hidden="true"
          />

          <div className="mb-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">외국어 전문가</h3>
                <p className="section-subtitle mt-1">외국어 가능 전문가와 함께하세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedLang(null)}
                className={selectedLang === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {ALL_LANGUAGES.map((lang) => {
                const flag = LANGUAGE_FLAGS[lang];
                const active = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(active ? null : lang)}
                    className={`${active ? 'chip-active' : 'chip-inactive'} flex items-center gap-1.5`}
                  >
                    {flag && (
                      <img
                        src={flag}
                        alt=""
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
                        draggable={false}
                      />
                    )}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 lg:grid-cols-5 lg:gap-x-4 lg:gap-y-8 relative z-10">
            {languagePros.slice(0, 9).map((pro, i) => (
              <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} languages={PRO_LANGUAGES[pro.id]} />
              </div>
            ))}
          </div>
          {languagePros.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 언어의 전문가가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. 기업회원 컨텐츠                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">웨딩 파트너</h3>
                <p className="section-subtitle mt-1">프리티풀이 엄선한 웨딩 업체를 만나보세요</p>
              </div>
              <Link href="/businesses" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-[10px] px-[10px] lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedBizCat(null)}
                className={selectedBizCat === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {BIZ_CATEGORIES.slice(1).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedBizCat(selectedBizCat === cat ? null : cat)}
                  className={selectedBizCat === cat ? 'chip-active' : 'chip-inactive'}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Coupon Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Gift size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">회원가입 후 설문조사 답변하면</p>
              <p className="text-[12px] text-white/70 mt-0.5">최대 50% 할인 쿠폰을 바로 드려요</p>
            </div>
            <Link href="/signup" className="ml-auto shrink-0 text-[12px] font-bold text-primary-600 bg-white px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              쿠폰 받기
            </Link>
          </div>

          {/* Business Cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            {filteredBiz.slice(0, 8).map((biz) => (
              <BusinessCard key={biz.id} biz={biz} />
            ))}
          </div>
          {filteredBiz.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 카테고리의 업체가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 7. 행사 맞춤의뢰 (Mobile only)                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="lg:hidden">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">📋</span>
              <div>
                <h3 className="text-[16px] font-extrabold text-gray-900">행사 맞춤의뢰</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">프리티풀의 완벽한 행사 인프라</p>
              </div>
            </div>
            <Link href="/match" className="p-1">
              <ChevronRight size={20} className="text-gray-400" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {EVENT_PACKAGES.map((pkg) => (
              <Link
                key={pkg.name}
                href={`/match?event=${encodeURIComponent(pkg.name)}`}
                className="flex flex-col items-center rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`w-full ${pkg.color} py-3 flex items-center justify-center`}>
                  <span className="text-[24px]">{pkg.icon}</span>
                </div>
                <span className="text-[12px] font-semibold text-gray-800 py-2.5 text-center leading-tight px-1">{pkg.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
