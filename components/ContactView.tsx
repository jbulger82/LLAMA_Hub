
import React from 'react';
import { useStore } from '../store';

export const ContactView: React.FC = () => {
    const contactEmail = useStore(state => state.settings.contactEmail);
    const contactPhone = useStore(state => state.settings.contactPhone);
    const contactAddress = useStore(state => state.settings.contactAddress);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const email = (form.elements.namedItem('email') as HTMLInputElement).value;
        const inquiry = (form.elements.namedItem('inquiry') as HTMLSelectElement).value;
        const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;

        if (!contactEmail) {
            alert("The destination email has not been configured in the application settings.");
            return;
        }

        const subject = `LlamaHub Contact Form: ${inquiry}`;
        const body = `Name: ${name}\nFrom: ${email}\n\nMessage:\n${message}`;

        const mailtoLink = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };

    return (
        <div>
            <div className="hero py-16 bg-base-200">
                <div className="hero-content flex-col lg:flex-row-reverse gap-12 container mx-auto">
                    <div className="text-center lg:text-left lg:max-w-lg">
                        <h1 className="text-5xl font-bold">Get in Touch</h1>
                        <p className="py-6 text-base-content/80">
                            We're excited to hear from you. Whether you're interested in our product, looking to partner, or considering an investment, our team is ready to answer your questions.
                        </p>
                        <div className="space-y-2 text-base-content/90">
                            <p><strong>Email:</strong> {contactEmail ? <a href={`mailto:${contactEmail}`} className="link link-primary">{contactEmail}</a> : <span className="text-base-content/60">Not Configured</span>}</p>
                            <p><strong>Phone:</strong> {contactPhone ? <a href={`tel:${contactPhone}`} className="link link-primary">{contactPhone}</a> : <span className="text-base-content/60">Not Configured</span>}</p>
                            <p><strong>Address:</strong> {contactAddress ? <span>{contactAddress}</span> : <span className="text-base-content/60">Not Configured</span>}</p>
                        </div>
                    </div>
                    <div className="card flex-shrink-0 w-full max-w-sm shadow-2xl bg-base-100 border border-base-300">
                        <form className="card-body" onSubmit={handleSubmit}>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Your Name</span>
                                </label>
                                <input name="name" type="text" placeholder="John Doe" className="input input-bordered" required />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Email</span>
                                </label>
                                <input name="email" type="email" placeholder="email@example.com" className="input input-bordered" required />
                            </div>
                             <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Inquiry Regarding</span>
                                </label>
                                <select name="inquiry" className="select select-bordered">
                                    <option>General</option>
                                    <option>Partnerships</option>
                                    <option>Investors</option>
                                    <option>Technical Support</option>
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Your Message</span>
                                </label>
                                <textarea name="message" className="textarea textarea-bordered h-24" placeholder="Your message..." required></textarea>
                            </div>
                            <div className="form-control mt-6">
                                <button className="btn btn-primary" type="submit">Send Message</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
