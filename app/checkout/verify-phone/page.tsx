const HeaderLogos = () => {
    // 1. بنك الرياض (5297)
    if (cardPrefixType === 'riyad') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <img src="/riyad-bank.png" alt="Riyad Bank" style={{ height: '35px', objectFit: 'contain' }} />
          <img src="/mastercard-id-check-stacked.png" alt="Mastercard ID Check" style={{ height: '35px', objectFit: 'contain' }} />
        </div>
      );
    }

    // 2. يوربلاي (4909)
    if (cardPrefixType === 'urpay') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <img src="/visa.png" alt="VISA" style={{ height: '32px', objectFit: 'contain' }} />
          <img src="/urpay.png" alt="urpay" style={{ height: '32px', objectFit: 'contain' }} />
        </div>
      );
    }

    // 3. البنك الأهلي ومدى (5161 / 5294)
    if (cardPrefixType === 'alahli_mada') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '540px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/snb-alahli.png" alt="SNB الأهلي" style={{ height: '30px', objectFit: 'contain' }} />
            <img src="/mada.png" alt="mada" style={{ height: '26px', objectFit: 'contain' }} />
          </div>
          <img src="/mastercard-id-check-stacked.png" alt="Mastercard ID Check" style={{ height: '35px', objectFit: 'contain' }} />
        </div>
      );
    }

    // 4. مصرف الراجحي (4847)
    if (cardPrefixType === 'alrajhi') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '520px', margin: '20px auto 25px auto', padding: '0 15px', direction: 'ltr' }}>
          <img src="/visa.png" alt="VISA" style={{ height: '32px', objectFit: 'contain' }} />
          <img src="/alrajhi-bank.png" alt="مصرف الراجحي" style={{ height: '35px', objectFit: 'contain' }} />
        </div>
      );
    }

    // 5. الافتراضي
    return (
      <div style={{ textAlign: 'center', margin: '20px auto 25px auto' }}>
        <img src="/visa.png" alt="VISA" style={{ height: '35px', objectFit: 'contain' }} />
      </div>
    );
  };
