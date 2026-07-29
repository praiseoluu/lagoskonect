/**
 * Lagos Konect — Welcome Page (East)
 * Route: /east/welcome → /east/home
 */
import Onboarding from '../../../components/onboarding/Onboarding.js';

export default class WelcomePage extends Onboarding {
  constructor(props) {
    super({ homeRoute: '/east/home', regionBrand: 'LagKonnect - East', ...props });
  }
}
