# Quick Start Guide - Seamless Trading

## ✅ Build Status: SUCCESS

The seamless trading implementation is complete and builds successfully!

## Environment Setup

Add this to your `.env.local`:

```bash
# Required for production builds
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optional: For gas sponsorship
NEXT_PUBLIC_PAYMASTER_URL=https://your-paymaster-url

# Your app URL
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

## Testing Locally

1. **Start development server:**

   ```bash
   npm run dev
   ```

2. **Test the flow:**
   - Connect your wallet
   - Navigate to a market
   - Try buying shares
   - Check console for sub account logs

## How to Add Permission Manager to Your UI

### Option 1: Add to Profile/Settings Page

```tsx
// In src/app/profile/page.tsx or similar
import { SpendPermissionManager } from "@/components/SpendPermissionManager";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1>Your Profile</h1>

      {/* Add Permission Manager */}
      <SpendPermissionManager />

      {/* Rest of your profile content */}
    </div>
  );
}
```

### Option 2: Add to Trading Page

```tsx
// In src/app/market/[marketId]/page.tsx
import { SpendPermissionManager } from "@/components/SpendPermissionManager";

export default function MarketPage() {
  return (
    <div className="space-y-6">
      {/* Market details */}

      {/* Add Permission Manager in sidebar or separate section */}
      <aside className="lg:col-span-1">
        <SpendPermissionManager />
      </aside>

      {/* Trading interface */}
    </div>
  );
}
```

### Option 3: Add to Dashboard

```tsx
// In src/components/enhanced-prediction-market-dashboard.tsx
import { SpendPermissionManager } from "./SpendPermissionManager";

export function EnhancedPredictionMarketDashboard() {
  return (
    <div className="space-y-6">
      {/* Dashboard header */}

      {/* Add Permission Manager */}
      <div className="grid gap-6 md:grid-cols-2">
        <SpendPermissionManager />
        {/* Other dashboard components */}
      </div>
    </div>
  );
}
```

## Testing the Seamless Flow

### Test Case 1: First Time User

1. ✅ Connect wallet
2. ✅ Sub account should be created automatically (check console)
3. ✅ Try to buy shares
4. ✅ Should see permission request (one time)
5. ✅ Approve permission
6. ✅ Trade executes without popup

### Test Case 2: Returning User with Active Permission

1. ✅ Connect wallet
2. ✅ Sub account loads
3. ✅ Try to buy shares
4. ✅ **NO POPUP** - Trade executes immediately! 🎉

### Test Case 3: Selling Shares

1. ✅ Own some shares
2. ✅ Try to sell
3. ✅ **NO POPUP** - Sell executes immediately (no permission needed)

### Test Case 4: Claiming Free Tokens

1. ✅ Navigate to free market
2. ✅ Try to claim
3. ✅ **NO POPUP** - Claim executes immediately

## Console Logs to Watch

When testing, check the browser console for:

```
Accounts from Base Account provider: [...]
Sub account initialized: 0x...
Universal account: 0x...
=== SEAMLESS PURCHASE ===
Sub account: 0x...
Required balance: ...
Transaction hash: 0x...
```

## Troubleshooting

### Issue: "Sub Account Not Ready"

**Solution:** Wait a moment for initialization, or check console for errors

### Issue: "Spender account not ready"

**Solution:** Sub account is still initializing, retry in a moment

### Issue: Permission request keeps appearing

**Solution:**

- Check remaining allowance in SpendPermissionManager
- Request a higher allowance amount
- Check permission hasn't expired

### Issue: Fallback to regular wallet popup

**Solution:**

- This is expected if sub account isn't ready
- Check if Base Account SDK initialized correctly
- Verify wallet supports Base Account features

## Production Checklist

Before deploying to production:

- [ ] Test on Base testnet (Sepolia)
- [ ] Test with different wallet providers
- [ ] Set appropriate permission allowances
- [ ] Set appropriate permission periods (30 days default)
- [ ] Add SpendPermissionManager to user-facing UI
- [ ] Set up error tracking/monitoring
- [ ] Test permission renewal flow
- [ ] Document user flow for your users
- [ ] Consider adding onboarding tooltip/guide

## Key Files Reference

| File                                         | Purpose                |
| -------------------------------------------- | ---------------------- |
| `src/lib/baseAccount.ts`                     | SDK initialization     |
| `src/hooks/useSubAccount.ts`                 | Sub account management |
| `src/hooks/useSpendPermission.ts`            | Permission management  |
| `src/components/SpendPermissionManager.tsx`  | Permission UI          |
| `src/components/market-v2-buy-interface.tsx` | Seamless buying        |
| `src/components/MarketV2SellInterface.tsx`   | Seamless selling       |
| `src/components/FreeTokenClaimButton.tsx`    | Seamless claiming      |

## Support & Resources

- [Full Implementation Guide](./SEAMLESS_TRADING_GUIDE.md)
- [Base Account Docs](https://docs.base.org/base-account)
- [GitHub Issues](https://github.com/base/base-account-sdk/issues)

---

**Status**: ✅ Build Successful - Ready to Test!
