/**
 * Lagos Konect — Welcome Page (App / no region)
 * Route: /welcome → /home
 */
import Onboarding from '../../../components/onboarding/Onboarding.js?v=20260806b';

export default class WelcomePage extends Onboarding {
  constructor(props) {
    super({ homeRoute: '/home', regionBrand: 'Lagos Konect', ...props });
  }
}
